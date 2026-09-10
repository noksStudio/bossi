import type { Tx } from './client';

/** ריטיינרים, תקופות וספר צריכה. */

export interface RetainerRow {
  id: string;
  customer_id: string;
  customer_name: string;
  name: string;
  monthly_fee: string;
  quota_amount: string;
  quota_unit: string;
  starts_on: Date;
  ends_on: Date | null;
  notice_days: number;
  price_updated_on: Date | null;
  status: string;

  /** התקופה הפתוחה והצריכה שלה — מגיעות יחד כי המסך לעולם לא רוצה אחת בלי השנייה. */
  period_id: string | null;
  period_starts_on: Date | null;
  period_ends_on: Date | null;
  period_quota: string | null;
  period_used: string;
  entry_count: number;
}

const SELECT = `
  select r.id, r.customer_id, c.display_name as customer_name, r.name,
         r.monthly_fee::text, r.quota_amount::text, r.quota_unit,
         r.starts_on, r.ends_on, r.notice_days, r.price_updated_on, r.status,
         p.id as period_id, p.starts_on as period_starts_on, p.ends_on as period_ends_on,
         p.quota_amount::text as period_quota,
         coalesce((select sum(e.quantity) from consumption_entries e where e.period_id = p.id), 0)::text
           as period_used,
         coalesce((select count(*) from consumption_entries e where e.period_id = p.id), 0)::text
           as entry_count
    from retainers r
    join customers c on c.id = r.customer_id
    left join lateral (
      select * from retainer_periods rp
       where rp.retainer_id = r.id and rp.status = 'open'
       order by rp.starts_on desc limit 1
    ) p on true
`;

export async function listRetainers(
  tx: Tx,
  f: { status?: string; customerId?: string } = {},
): Promise<RetainerRow[]> {
  const { rows } = await tx.query<RetainerRow & { entry_count: string }>(
    `${SELECT}
      where ($1::text is null or r.status = $1)
        and ($2::uuid is null or r.customer_id = $2)
      order by c.display_name`,
    [f.status ?? null, f.customerId ?? null],
  );
  return rows.map((r) => ({ ...r, entry_count: Number(r.entry_count) }));
}

export async function getRetainer(tx: Tx, id: string): Promise<RetainerRow | null> {
  const { rows } = await tx.query<RetainerRow & { entry_count: string }>(`${SELECT} where r.id = $1`, [id]);
  const row = rows[0];
  return row ? { ...row, entry_count: Number(row.entry_count) } : null;
}

export interface ConsumptionRow {
  id: string;
  occurred_on: Date;
  quantity: string;
  description: string;
  user_name: string | null;
  billable: boolean;
}

export async function listConsumption(tx: Tx, periodId: string, limit = 200): Promise<ConsumptionRow[]> {
  const { rows } = await tx.query<ConsumptionRow>(
    `select e.id, e.occurred_on, e.quantity::text, e.description, u.name as user_name, e.billable
       from consumption_entries e
       left join users u on u.id = e.user_id
      where e.period_id = $1
      order by e.occurred_on desc, e.created_at desc
      limit $2`,
    [periodId, limit],
  );
  return rows;
}

/** ההיסטוריה: תקופות סגורות, מהחדשה לישנה. הראיה מול "למה החשבון עלה". */
export interface PeriodSummary {
  id: string;
  starts_on: Date;
  ends_on: Date;
  quota_amount: string;
  used: string;
  status: string;
}

export async function listPeriods(tx: Tx, retainerId: string, limit = 12): Promise<PeriodSummary[]> {
  const { rows } = await tx.query<PeriodSummary>(
    `select p.id, p.starts_on, p.ends_on, p.quota_amount::text, p.status,
            coalesce((select sum(e.quantity) from consumption_entries e where e.period_id = p.id), 0)::text as used
       from retainer_periods p
      where p.retainer_id = $1
      order by p.starts_on desc
      limit $2`,
    [retainerId, limit],
  );
  return rows;
}

export async function createRetainer(
  tx: Tx,
  input: {
    customerId: string; name: string; monthlyFee: string; quotaAmount: string;
    quotaUnit?: string; startsOn: string; endsOn?: string | null;
    noticeDays?: number; priceUpdatedOn?: string | null;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into retainers
       (tenant_id, customer_id, name, monthly_fee, quota_amount, quota_unit,
        starts_on, ends_on, notice_days, price_updated_on)
     values (current_tenant(), $1, $2, $3, $4, coalesce($5, 'hours'), $6::date, $7::date,
             coalesce($8, 30), $9::date)
     returning id`,
    [input.customerId, input.name, input.monthlyFee, input.quotaAmount, input.quotaUnit ?? null,
     input.startsOn, input.endsOn ?? null, input.noticeDays ?? null, input.priceUpdatedOn ?? null],
  );
  return rows[0]!.id;
}

export async function openPeriod(
  tx: Tx,
  input: { retainerId: string; startsOn: string; endsOn: string; quotaAmount: string; status?: string },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into retainer_periods (tenant_id, retainer_id, starts_on, ends_on, quota_amount, status)
     values (current_tenant(), $1, $2::date, $3::date, $4, coalesce($5, 'open'))
     on conflict (tenant_id, retainer_id, starts_on) do update set quota_amount = excluded.quota_amount
     returning id`,
    [input.retainerId, input.startsOn, input.endsOn, input.quotaAmount, input.status ?? null],
  );
  return rows[0]!.id;
}

export async function logConsumption(
  tx: Tx,
  input: { periodId: string; quantity: string; description: string; occurredOn?: string; userId?: string | null; billable?: boolean },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into consumption_entries (tenant_id, period_id, quantity, description, occurred_on, user_id, billable)
     values (current_tenant(), $1, $2, $3, coalesce($4::date, current_date), $5, coalesce($6, true))
     returning id`,
    [input.periodId, input.quantity, input.description, input.occurredOn ?? null,
     input.userId ?? null, input.billable ?? null],
  );
  return rows[0]!.id;
}
