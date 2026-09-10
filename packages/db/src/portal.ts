import type { Tx } from './client';

/**
 * משתמשי פורטל — הריאלם השני של הזהות (CLAUDE.md כלל 2).
 *
 * טבלה נפרדת מ-`users` בכוונה, לא תפקיד על טבלה אחת: באג הרשאות אחד
 * בצד הצוות לא יכול לפתוח דלת ללקוח, ולהפך.
 */

export interface PortalUserRow {
  id: string;
  customer_id: string;
  customer_name: string;
  email: string;
  name: string;
  status: string;
  permissions: string[];
  invited_at: Date;
  last_seen_at: Date | null;
}

export async function listPortalUsers(
  tx: Tx,
  f: { customerId?: string; status?: string } = {},
): Promise<PortalUserRow[]> {
  const { rows } = await tx.query<PortalUserRow>(
    `select pu.id, pu.customer_id, c.display_name as customer_name, pu.email, pu.name,
            pu.status, pu.permissions, pu.invited_at, pu.last_seen_at
       from portal_users pu
       join customers c on c.id = pu.customer_id
      where ($1::uuid is null or pu.customer_id = $1)
        and ($2::text is null or pu.status = $2)
      order by
        case pu.status when 'invited' then 0 when 'active' then 1 else 2 end,
        c.display_name, pu.name`,
    [f.customerId ?? null, f.status ?? null],
  );
  return rows;
}

export async function invitePortalUser(
  tx: Tx,
  input: { customerId: string; email: string; name: string; permissions?: string[]; status?: string; invitedAt?: Date; lastSeenAt?: Date | null },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into portal_users (tenant_id, customer_id, email, name, permissions, status, invited_at, last_seen_at)
     values (current_tenant(), $1, $2, $3, coalesce($4, '{}'::text[]), coalesce($5, 'invited'),
             coalesce($6::timestamptz, now()), $7::timestamptz)
     on conflict (tenant_id, lower(email)) do update
       set name = excluded.name, permissions = excluded.permissions, status = excluded.status
     returning id`,
    [input.customerId, input.email, input.name, input.permissions ?? null,
     input.status ?? null, input.invitedAt ?? null, input.lastSeenAt ?? null],
  );
  return rows[0]!.id;
}

export async function setPortalUserStatus(tx: Tx, id: string, status: 'active' | 'invited' | 'revoked'): Promise<boolean> {
  const { rowCount } = await tx.query('update portal_users set status = $2 where id = $1', [id, status]);
  return (rowCount ?? 0) > 0;
}
