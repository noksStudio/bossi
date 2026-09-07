import type { Tx } from './client';

/** פנקס הצ'קים הדחויים והתאמה חודשית. */

export interface CheckRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  lease_id: string | null;
  property_name: string | null;
  check_number: string | null;
  bank_name: string | null;
  branch_code: string | null;
  account_number: string | null;
  amount: string;
  due_on: Date;
  status: 'pending' | 'cleared' | 'partial' | 'bounced' | 'void';
  cleared_on: Date | null;
  cleared_amount: string | null;
  cleared_by_name: string | null;
  cleared_at: Date | null;
  notes: string | null;
}

const SELECT = `
  select k.id, k.customer_id, c.display_name as customer_name,
         k.lease_id, p.name as property_name,
         k.check_number, k.bank_name, k.branch_code, k.account_number,
         k.amount::text, k.due_on, k.status,
         k.cleared_on, k.cleared_amount::text, u.name as cleared_by_name, k.cleared_at,
         k.notes
    from checks k
    join customers c on c.id = k.customer_id
    left join leases l on l.id = k.lease_id
    left join properties p on p.id = l.property_id
    left join users u on u.id = k.cleared_by
`;

/** הצ'קים של חודש מסוים — המסך שראובן יחיה בו. */
export async function checksForMonth(tx: Tx, from: string, to: string): Promise<CheckRow[]> {
  const { rows } = await tx.query<CheckRow>(
    `${SELECT} where k.due_on between $1::date and $2::date
      order by k.due_on, c.display_name`,
    [from, to],
  );
  return rows;
}

/**
 * צ'קים שעברו את תאריך הפירעון ועדיין לא סומנו.
 *
 * נשלף בנפרד מהחודש הנוכחי בכוונה: צ'ק מיולי שלא סומן חייב להמשיך
 * לצוף גם בספטמבר, אחרת הוא נעלם עם גלגול החודש — וזה בדיוק הכסף
 * שהמערכת אמורה לשמור.
 */
export async function overdueChecks(tx: Tx, before?: string): Promise<CheckRow[]> {
  const { rows } = await tx.query<CheckRow>(
    `${SELECT} where k.status = 'pending' and k.due_on < coalesce($1::date, current_date)
      order by k.due_on`,
    [before ?? null],
  );
  return rows;
}

export async function checksForCustomer(tx: Tx, customerId: string, limit = 24): Promise<CheckRow[]> {
  const { rows } = await tx.query<CheckRow>(
    `${SELECT} where k.customer_id = $1 order by k.due_on desc limit $2`,
    [customerId, limit],
  );
  return rows;
}

export async function getCheck(tx: Tx, id: string): Promise<CheckRow | null> {
  const { rows } = await tx.query<CheckRow>(`${SELECT} where k.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface MarkInput {
  status: 'cleared' | 'partial' | 'bounced' | 'void' | 'pending';
  clearedAmount?: string | null;
  clearedOn?: string | null;
  notes?: string | null;
}

/**
 * סימון הצ'ק. **מי סימן ומתי נשמר תמיד** — זה לא נתון עזר, זו הראיה
 * שמישהו באמת בדק מול הבנק.
 *
 * חזרה ל-`pending` מנקה את הסימון, כדי שתיקון טעות לא ישאיר חתימה
 * של בדיקה שלא נעשתה.
 */
export async function markCheck(tx: Tx, id: string, input: MarkInput): Promise<boolean> {
  const clearing = input.status === 'cleared' || input.status === 'partial';
  const { rowCount } = await tx.query(
    `update checks set
       status         = $2,
       cleared_amount = case when $2 = 'partial' then $3::numeric
                             when $2 = 'cleared' then amount
                             else null end,
       cleared_on     = case when $4 then coalesce($5::date, current_date) else null end,
       cleared_by     = case when $4 then current_user_id() else null end,
       cleared_at     = case when $4 then now() else null end,
       notes          = coalesce($6, notes)
     where id = $1`,
    [id, input.status, input.clearedAmount ?? null, clearing, input.clearedOn ?? null, input.notes ?? null],
  );
  return (rowCount ?? 0) > 0;
}

export async function createCheck(
  tx: Tx,
  input: {
    customerId: string;
    leaseId?: string | null;
    batchId?: string | null;
    checkNumber?: string | null;
    bankName?: string | null;
    branchCode?: string | null;
    accountNumber?: string | null;
    amount: string;
    dueOn: string;
    notes?: string | null;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into checks
       (tenant_id, customer_id, lease_id, batch_id, check_number, bank_name,
        branch_code, account_number, amount, due_on, notes)
     values (current_tenant(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id`,
    [
      input.customerId, input.leaseId ?? null, input.batchId ?? null,
      input.checkNumber ?? null, input.bankName ?? null, input.branchCode ?? null,
      input.accountNumber ?? null, input.amount, input.dueOn, input.notes ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function createCheckBatch(
  tx: Tx,
  input: { customerId: string; leaseId?: string | null; receivedOn?: string; location?: string | null },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into check_batches (tenant_id, customer_id, lease_id, received_on, location)
     values (current_tenant(), $1, $2, coalesce($3::date, current_date), $4) returning id`,
    [input.customerId, input.leaseId ?? null, input.receivedOn ?? null, input.location ?? null],
  );
  return rows[0]!.id;
}
