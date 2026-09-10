import type { Tx } from './client';

/**
 * חשבוניות, תקבולים והקצאות.
 *
 * `paid_amount` מגיע כתת-שאילתה ולא כעמודה שמורה — היתרה נגזרת תמיד
 * מההקצאות בפועל. עמודה שמורה הייתה מהירה יותר וגם שקרית מדי פעם,
 * וזה חילוף גרוע כשמדובר בכסף.
 */

export interface InvoiceRow {
  id: string;
  customer_id: string;
  customer_name: string;
  number: string;
  issued_on: Date;
  due_on: Date;
  amount: string;
  vat_amount: string;
  paid_amount: string;
  status: string;
  subject: string | null;
  source: string | null;
}

const SELECT = `
  select i.id, i.customer_id, c.display_name as customer_name, i.number,
         i.issued_on, i.due_on, i.amount::text, i.vat_amount::text,
         coalesce((select sum(a.amount) from payment_allocations a where a.invoice_id = i.id), 0)::text
           as paid_amount,
         i.status, i.subject, i.source
    from invoices i
    join customers c on c.id = i.customer_id
`;

export interface InvoiceFilters {
  status?: string;
  customerId?: string;
  /** רק מה שנשארה בו יתרה. זו השאלה של מסך הגבייה. */
  openOnly?: boolean;
  limit?: number;
}

export async function listInvoices(tx: Tx, f: InvoiceFilters = {}): Promise<InvoiceRow[]> {
  const { rows } = await tx.query<InvoiceRow>(
    `${SELECT}
      where ($1::text is null or i.status = $1)
        and ($2::uuid is null or i.customer_id = $2)
        and ($3::boolean is not true or (
              i.status = 'open'
              and i.amount > coalesce(
                (select sum(a.amount) from payment_allocations a where a.invoice_id = i.id), 0)
            ))
      order by i.due_on, i.number
      limit $4`,
    [f.status ?? null, f.customerId ?? null, f.openOnly ?? null, f.limit ?? 500],
  );
  return rows;
}

export async function getInvoice(tx: Tx, id: string): Promise<InvoiceRow | null> {
  const { rows } = await tx.query<InvoiceRow>(`${SELECT} where i.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface PaymentRow {
  id: string;
  customer_id: string;
  customer_name: string;
  received_on: Date;
  amount: string;
  method: string;
  reference: string | null;
  check_id: string | null;
  allocated: string;
}

export async function listPayments(
  tx: Tx,
  f: { customerId?: string; since?: string; limit?: number } = {},
): Promise<PaymentRow[]> {
  const { rows } = await tx.query<PaymentRow>(
    `select p.id, p.customer_id, c.display_name as customer_name, p.received_on,
            p.amount::text, p.method, p.reference, p.check_id,
            coalesce((select sum(a.amount) from payment_allocations a where a.payment_id = p.id), 0)::text
              as allocated
       from payments p
       join customers c on c.id = p.customer_id
      where ($1::uuid is null or p.customer_id = $1)
        and ($2::date is null or p.received_on >= $2::date)
      order by p.received_on desc, c.display_name
      limit $3`,
    [f.customerId ?? null, f.since ?? null, f.limit ?? 200],
  );
  return rows;
}

/** יתרה פתוחה ללקוח — לכרטיס הלקוח ולשער אישור ההזמנות. */
export interface CustomerBalance {
  customer_id: string;
  open_amount: string;
  overdue_amount: string;
  open_count: number;
  oldest_due_on: Date | null;
}

export async function customerBalances(tx: Tx, customerId?: string): Promise<CustomerBalance[]> {
  const { rows } = await tx.query<CustomerBalance & { open_count: string }>(
    `select i.customer_id,
            sum(i.amount - i.paid)::text                                   as open_amount,
            sum(case when i.due_on < current_date then i.amount - i.paid else 0 end)::text
                                                                           as overdue_amount,
            count(*)::text                                                 as open_count,
            min(i.due_on)                                                  as oldest_due_on
       from (
         select i.customer_id, i.amount, i.due_on,
                coalesce((select sum(a.amount) from payment_allocations a where a.invoice_id = i.id), 0) as paid
           from invoices i where i.status = 'open'
       ) i
      where i.amount > i.paid
        and ($1::uuid is null or i.customer_id = $1)
      group by i.customer_id`,
    [customerId ?? null],
  );
  return rows.map((r) => ({ ...r, open_count: Number(r.open_count) }));
}

/** ההבטחה הפתוחה או האחרונה שהופרה, לכל לקוח. משמשת לתעדוף הגבייה. */
export interface PromiseRow {
  id: string;
  customer_id: string;
  customer_name: string;
  promised_on: Date;
  promised_for: Date;
  amount: string | null;
  status: string;
  channel: string | null;
  notes: string | null;
}

export async function listPromises(tx: Tx, f: { customerId?: string; openOnly?: boolean } = {}): Promise<PromiseRow[]> {
  const { rows } = await tx.query<PromiseRow>(
    `select p.id, p.customer_id, c.display_name as customer_name, p.promised_on,
            p.promised_for, p.amount::text, p.status, p.channel, p.notes
       from promises_to_pay p
       join customers c on c.id = p.customer_id
      where ($1::uuid is null or p.customer_id = $1)
        and ($2::boolean is not true or p.status = 'open')
      order by p.promised_for desc`,
    [f.customerId ?? null, f.openOnly ?? null],
  );
  return rows;
}

/** מתי דיברנו עם הלקוח לאחרונה בענייני גבייה. */
export async function lastDunning(tx: Tx): Promise<Array<{ customer_id: string; sent_at: Date; channel: string; step: number }>> {
  const { rows } = await tx.query<{ customer_id: string; sent_at: Date; channel: string; step: string }>(
    `select distinct on (customer_id) customer_id, sent_at, channel, step::text
       from dunning_runs order by customer_id, sent_at desc`,
  );
  return rows.map((r) => ({ ...r, step: Number(r.step) }));
}

export async function createInvoice(
  tx: Tx,
  input: {
    customerId: string; number: string; amount: string; vatAmount?: string;
    issuedOn: string; dueOn: string; subject?: string | null; source?: string | null;
    status?: string;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into invoices (tenant_id, customer_id, number, amount, vat_amount, issued_on, due_on, subject, source, status)
     values (current_tenant(), $1, $2, $3, coalesce($4::numeric, 0), $5::date, $6::date, $7, $8, coalesce($9, 'open'))
     returning id`,
    [input.customerId, input.number, input.amount, input.vatAmount ?? null,
     input.issuedOn, input.dueOn, input.subject ?? null, input.source ?? null, input.status ?? null],
  );
  return rows[0]!.id;
}

/**
 * תקבול + הקצאה, בפעולה אחת.
 *
 * הקצאה שנעשית "אחר כך" נשכחת, ואז יש כסף בקופה וחשבונית פתוחה על
 * אותו סכום — התלונה הכי נפוצה על מערכות גבייה.
 */
export async function recordPayment(
  tx: Tx,
  input: {
    customerId: string; amount: string; receivedOn: string; method?: string;
    reference?: string | null; checkId?: string | null;
    allocations?: Array<{ invoiceId: string; amount: string }>;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into payments (tenant_id, customer_id, amount, received_on, method, reference, check_id)
     values (current_tenant(), $1, $2, $3::date, coalesce($4, 'transfer'), $5, $6) returning id`,
    [input.customerId, input.amount, input.receivedOn, input.method ?? null,
     input.reference ?? null, input.checkId ?? null],
  );
  const paymentId = rows[0]!.id;

  for (const a of input.allocations ?? []) {
    await tx.query(
      `insert into payment_allocations (tenant_id, payment_id, invoice_id, amount)
       values (current_tenant(), $1, $2, $3)`,
      [paymentId, a.invoiceId, a.amount],
    );
    // חשבונית שנסגרה במלואה משנה סטטוס מיד. סריקת רקע שעושה זאת
    // "בלילה" משאירה את המסך שקרי כל היום.
    await tx.query(
      `update invoices set status = 'paid'
        where id = $1 and status = 'open'
          and amount <= coalesce((select sum(x.amount) from payment_allocations x where x.invoice_id = $1), 0)`,
      [a.invoiceId],
    );
  }

  return paymentId;
}

export async function recordPromise(
  tx: Tx,
  input: { customerId: string; promisedFor: string; amount?: string | null; channel?: string | null; notes?: string | null; invoiceId?: string | null },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into promises_to_pay (tenant_id, customer_id, invoice_id, promised_for, amount, channel, notes, created_by)
     values (current_tenant(), $1, $2, $3::date, $4, $5, $6, current_user_id()) returning id`,
    [input.customerId, input.invoiceId ?? null, input.promisedFor,
     input.amount ?? null, input.channel ?? null, input.notes ?? null],
  );
  return rows[0]!.id;
}

export async function recordDunning(
  tx: Tx,
  input: {
    customerId: string; invoiceId?: string | null; channel: string; tone: string;
    step?: number; sentAt?: Date;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into dunning_runs (tenant_id, customer_id, invoice_id, channel, tone, step, sent_at)
     values (current_tenant(), $1, $2, $3, $4, coalesce($5, 1), coalesce($6::timestamptz, now()))
     returning id`,
    [input.customerId, input.invoiceId ?? null, input.channel, input.tone,
     input.step ?? null, input.sentAt ?? null],
  );
  return rows[0]!.id;
}
