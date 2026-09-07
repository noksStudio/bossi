import type { Tx } from './client';

export interface PropertyRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  rooms: string | null;
  size_sqm: number | null;
  status: string;
}

export interface LeaseRow {
  id: string;
  property_id: string;
  property_name: string;
  property_address: string | null;
  customer_id: string;
  customer_name: string;
  starts_on: Date;
  ends_on: Date;
  notice_days: number;
  monthly_rent: string;
  deposit_amount: string | null;
  option_months: number | null;
  status: string;
  signed_on: Date | null;
}

const SELECT = `
  select l.id, l.property_id, p.name as property_name, p.address as property_address,
         l.customer_id, c.display_name as customer_name,
         l.starts_on, l.ends_on, l.notice_days, l.monthly_rent::text,
         l.deposit_amount::text, l.option_months, l.status, l.signed_on
    from leases l
    join properties p on p.id = l.property_id
    join customers c on c.id = l.customer_id
`;

export async function listLeases(
  tx: Tx,
  opts: { status?: string; customerId?: string } = {},
): Promise<LeaseRow[]> {
  const { rows } = await tx.query<LeaseRow>(
    `${SELECT}
      where ($1::text is null or l.status = $1)
        and ($2::uuid is null or l.customer_id = $2)
      order by l.ends_on`,
    [opts.status ?? null, opts.customerId ?? null],
  );
  return rows;
}

export async function getLease(tx: Tx, id: string): Promise<LeaseRow | null> {
  const { rows } = await tx.query<LeaseRow>(`${SELECT} where l.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listProperties(tx: Tx): Promise<PropertyRow[]> {
  const { rows } = await tx.query<PropertyRow>(
    `select id, name, address, city, rooms::text, size_sqm, status
       from properties order by name`,
  );
  return rows;
}

export async function createProperty(
  tx: Tx,
  input: { name: string; address?: string | null; city?: string | null; rooms?: number | null; sizeSqm?: number | null },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into properties (tenant_id, name, address, city, rooms, size_sqm)
     values (current_tenant(), $1, $2, $3, $4, $5) returning id`,
    [input.name, input.address ?? null, input.city ?? null, input.rooms ?? null, input.sizeSqm ?? null],
  );
  return rows[0]!.id;
}

export async function createLease(
  tx: Tx,
  input: {
    propertyId: string;
    customerId: string;
    startsOn: string;
    endsOn: string;
    monthlyRent: string;
    noticeDays?: number;
    depositAmount?: string | null;
    optionMonths?: number | null;
    signedOn?: string | null;
    status?: string;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into leases
       (tenant_id, property_id, customer_id, starts_on, ends_on, monthly_rent,
        notice_days, deposit_amount, option_months, signed_on, status)
     values (current_tenant(), $1, $2, $3, $4, $5, coalesce($6, 90), $7, $8, $9, coalesce($10, 'active'))
     returning id`,
    [
      input.propertyId, input.customerId, input.startsOn, input.endsOn, input.monthlyRent,
      input.noticeDays ?? null, input.depositAmount ?? null, input.optionMonths ?? null,
      input.signedOn ?? null, input.status ?? null,
    ],
  );
  await tx.query('update properties set status = $2 where id = $1', [input.propertyId, 'rented']);
  return rows[0]!.id;
}
