import type { Tx } from './client';

/**
 * שכבת השאילתות. כל פונקציה מקבלת `tx` שכבר נמצא בהקשר של דייר —
 * ולכן אף שאילתה כאן לא מזכירה tenant_id בתנאי. הבידוד הוא של המסד,
 * לא של הקוד הזה, וזו בדיוק הנקודה: אי אפשר לשכוח.
 *
 * היוצא מן הכלל היחיד הוא INSERT, שחייב לציין tenant_id כדי לעבור את
 * ה-WITH CHECK של המדיניות. הערך נלקח מ-current_tenant() ולא מהקורא,
 * כך שגם קורא זדוני לא יכול לכתוב לדייר אחר.
 */

// ── לקוחות ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  display_name: string;
  legal_name: string | null;
  business_id: string | null;
  status: string;
  payment_terms_days: number;
  credit_limit: string | null;
  tags: string[];
  created_at: Date;
}

export async function listCustomers(
  tx: Tx,
  opts: { status?: string; search?: string; limit?: number } = {},
): Promise<Customer[]> {
  const { rows } = await tx.query<Customer>(
    `select id, display_name, legal_name, business_id, status,
            payment_terms_days, credit_limit, tags, created_at
       from customers
      where ($1::text is null or status = $1)
        and ($2::text is null or display_name ilike '%' || $2 || '%')
      order by display_name
      limit $3`,
    [opts.status ?? null, opts.search ?? null, opts.limit ?? 200],
  );
  return rows;
}

export async function getCustomer(tx: Tx, id: string): Promise<Customer | null> {
  const { rows } = await tx.query<Customer>(
    `select id, display_name, legal_name, business_id, status,
            payment_terms_days, credit_limit, tags, created_at
       from customers where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createCustomer(
  tx: Tx,
  input: {
    displayName: string;
    legalName?: string | null;
    businessId?: string | null;
    status?: 'active' | 'prospect' | 'dormant' | 'archived';
    paymentTermsDays?: number;
    creditLimit?: string | null;
    tags?: string[];
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into customers
       (tenant_id, display_name, legal_name, business_id, status, payment_terms_days, credit_limit, tags)
     values (current_tenant(), $1, $2, $3, coalesce($4, 'active'), coalesce($5, 30), $6, coalesce($7, '{}'::text[]))
     returning id`,
    [
      input.displayName,
      input.legalName ?? null,
      input.businessId ?? null,
      input.status ?? null,
      input.paymentTermsDays ?? null,
      input.creditLimit ?? null,
      input.tags ?? null,
    ],
  );
  return rows[0]!.id;
}

// ── אנשי קשר ──────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  is_primary: boolean;
}

export async function listContacts(tx: Tx, customerId: string): Promise<Contact[]> {
  const { rows } = await tx.query<Contact>(
    `select id, customer_id, name, email, phone, roles, is_primary
       from contacts where customer_id = $1 order by is_primary desc, name`,
    [customerId],
  );
  return rows;
}

export async function createContact(
  tx: Tx,
  input: {
    customerId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    roles?: string[];
    isPrimary?: boolean;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into contacts (tenant_id, customer_id, name, email, phone, roles, is_primary)
     values (current_tenant(), $1, $2, $3, $4, coalesce($5, '{}'::text[]), coalesce($6, false))
     returning id`,
    [
      input.customerId,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.roles ?? null,
      input.isPrimary ?? null,
    ],
  );
  return rows[0]!.id;
}

// ── מודולים פעילים ────────────────────────────────────────────────────────

export async function enabledModules(tx: Tx): Promise<string[]> {
  const { rows } = await tx.query<{ module_id: string }>(
    `select module_id from tenant_modules where enabled order by module_id`,
  );
  return rows.map((r) => r.module_id);
}

export async function setModuleEnabled(
  tx: Tx,
  moduleId: string,
  enabled: boolean,
): Promise<void> {
  await tx.query(
    `insert into tenant_modules (tenant_id, module_id, enabled)
     values (current_tenant(), $1, $2)
     on conflict (tenant_id, module_id) do update
       set enabled = excluded.enabled,
           disabled_at = case when excluded.enabled then null else now() end`,
    [moduleId, enabled],
  );
}

// ── משתמשי צוות ───────────────────────────────────────────────────────────

export async function createUser(
  tx: Tx,
  input: { email: string; name: string; role?: string },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into users (tenant_id, email, name, role)
     values (current_tenant(), $1, $2, coalesce($3, 'staff'))
     returning id`,
    [input.email, input.name, input.role ?? null],
  );
  return rows[0]!.id;
}

// ── מנוי ──────────────────────────────────────────────────────────────────

export interface Subscription {
  plan: 'starter' | 'pro' | 'mega';
  status: string;
  current_period_start: Date;
  current_period_end: Date;
}

export async function currentSubscription(tx: Tx): Promise<Subscription | null> {
  const { rows } = await tx.query<Subscription>(
    `select plan, status, current_period_start, current_period_end from subscriptions`,
  );
  return rows[0] ?? null;
}

// ── כרטיס לקוח ────────────────────────────────────────────────────────────

export interface CustomerDetail extends Customer {
  notes: string | null;
  contacts: Contact[];
  event_count: number;
}

export async function getCustomerDetail(tx: Tx, id: string): Promise<CustomerDetail | null> {
  const { rows } = await tx.query<Customer & { notes: string | null; event_count: string }>(
    `select c.id, c.display_name, c.legal_name, c.business_id, c.status,
            c.payment_terms_days, c.credit_limit, c.tags, c.notes, c.created_at,
            (select count(*) from events e where e.customer_id = c.id)::text as event_count
       from customers c where c.id = $1`,
    [id],
  );
  const customer = rows[0];
  if (!customer) return null;

  return {
    ...customer,
    event_count: Number(customer.event_count),
    contacts: await listContacts(tx, id),
  };
}

export async function updateCustomer(
  tx: Tx,
  id: string,
  patch: {
    displayName?: string;
    legalName?: string | null;
    businessId?: string | null;
    status?: string;
    paymentTermsDays?: number;
    creditLimit?: string | null;
    notes?: string | null;
  },
): Promise<boolean> {
  // coalesce על כל שדה: מה שלא נשלח לא משתנה, בלי לבנות SQL דינמי.
  const { rowCount } = await tx.query(
    `update customers set
       display_name       = coalesce($2, display_name),
       legal_name         = coalesce($3, legal_name),
       business_id        = coalesce($4, business_id),
       status             = coalesce($5, status),
       payment_terms_days = coalesce($6, payment_terms_days),
       credit_limit       = coalesce($7, credit_limit),
       notes              = coalesce($8, notes)
     where id = $1`,
    [
      id,
      patch.displayName ?? null,
      patch.legalName ?? null,
      patch.businessId ?? null,
      patch.status ?? null,
      patch.paymentTermsDays ?? null,
      patch.creditLimit ?? null,
      patch.notes ?? null,
    ],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteContact(tx: Tx, id: string): Promise<boolean> {
  const { rowCount } = await tx.query('delete from contacts where id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

/** חיפוש מהיר ללוח הפקודות. trigram מטפל גם בשגיאות כתיב קלות. */
export async function quickSearchCustomers(
  tx: Tx,
  query: string,
  limit = 8,
): Promise<Array<{ id: string; display_name: string; status: string }>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const { rows } = await tx.query<{ id: string; display_name: string; status: string }>(
      `select id, display_name, status from customers
        where status = 'active' order by created_at desc limit $1`,
      [limit],
    );
    return rows;
  }

  const { rows } = await tx.query<{ id: string; display_name: string; status: string }>(
    `select id, display_name, status
       from customers
      where display_name ilike '%' || $1 || '%'
         or legal_name ilike '%' || $1 || '%'
         or business_id like $1 || '%'
      order by
        case when display_name ilike $1 || '%' then 0 else 1 end,
        similarity(display_name, $1) desc,
        display_name
      limit $2`,
    [trimmed, limit],
  );
  return rows;
}
