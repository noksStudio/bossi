import { createHash, randomBytes } from 'node:crypto';
import type { Tx } from './client';

/**
 * החתמה בקישור.
 *
 * הטוקן נשמר כ-hash בלבד. קישור חתימה שדלף מלוג, מגיבוי או מדוח שגיאות
 * הוא חתימה של מישהו אחר — ו-hash הופך את הדליפה לחסרת ערך.
 *
 * החותם אינו משתמש מערכת ואינו משתמש פורטל: זהו עולם גישה שלישי,
 * מבודד משני האחרים, שכל כולו הקישור הזה.
 */

export interface SigningRow {
  id: string;
  customer_id: string;
  customer_name: string;
  document_id: string | null;
  title: string;
  signer_name: string;
  signer_email: string | null;
  signer_phone: string | null;
  status: string;
  sent_at: Date;
  expires_at: Date;
  viewed_at: Date | null;
  signed_at: Date | null;
  declined_at: Date | null;
  decline_reason: string | null;
  reminded_at: Date | null;
  reminder_count: number;
}

const SELECT = `
  select s.id, s.customer_id, c.display_name as customer_name, s.document_id, s.title,
         s.signer_name, s.signer_email, s.signer_phone, s.status, s.sent_at, s.expires_at,
         s.viewed_at, s.signed_at, s.declined_at, s.decline_reason,
         s.reminded_at, s.reminder_count
    from signing_requests s
    join customers c on c.id = s.customer_id
`;

export async function listSigningRequests(
  tx: Tx,
  f: { status?: string; customerId?: string; limit?: number } = {},
): Promise<SigningRow[]> {
  const { rows } = await tx.query<SigningRow & { reminder_count: string }>(
    `${SELECT}
      where ($1::text is null or s.status = $1)
        and ($2::uuid is null or s.customer_id = $2)
      order by
        case s.status when 'viewed' then 0 when 'sent' then 1 when 'declined' then 2 else 3 end,
        s.sent_at desc
      limit $3`,
    [f.status ?? null, f.customerId ?? null, f.limit ?? 100],
  );
  return rows.map((r) => ({ ...r, reminder_count: Number(r.reminder_count) }));
}

export interface SigningEventRow {
  id: string;
  kind: string;
  occurred_at: Date;
  ip: string | null;
  detail: Record<string, unknown>;
}

export async function signingTrail(tx: Tx, requestId: string): Promise<SigningEventRow[]> {
  const { rows } = await tx.query<SigningEventRow>(
    `select id, kind, occurred_at, ip, detail from signing_events
      where request_id = $1 order by occurred_at`,
    [requestId],
  );
  return rows;
}

export const SIGNING_EVENT_LABELS: Record<string, string> = {
  sent: 'הקישור נשלח',
  viewed: 'המסמך נפתח',
  otp_sent: 'נשלח קוד אימות',
  otp_verified: 'הקוד אומת',
  signed: 'המסמך נחתם',
  declined: 'החותם סירב',
  reminded: 'נשלחה תזכורת',
  expired: 'הקישור פג',
};

/**
 * יוצר בקשת חתימה ומחזיר את הטוקן **פעם אחת בלבד** — הוא לא נשמר
 * ולא ניתן לשחזור. שליחה חוזרת מייצרת קישור חדש.
 */
export async function createSigningRequest(
  tx: Tx,
  input: {
    customerId: string; title: string; signerName: string;
    signerEmail?: string | null; signerPhone?: string | null;
    documentId?: string | null; ttlDays?: number;
    sentAt?: Date; status?: string;
  },
): Promise<{ id: string; token: string }> {
  const token = randomBytes(24).toString('base64url');
  const { rows } = await tx.query<{ id: string }>(
    `insert into signing_requests
       (tenant_id, customer_id, document_id, title, signer_name, signer_email, signer_phone,
        token_hash, sent_at, expires_at, status)
     values (current_tenant(), $1, $2, $3, $4, $5, $6, $7,
             coalesce($8::timestamptz, now()),
             coalesce($8::timestamptz, now()) + make_interval(days => coalesce($9, 14)),
             coalesce($10, 'sent'))
     returning id`,
    [input.customerId, input.documentId ?? null, input.title, input.signerName,
     input.signerEmail ?? null, input.signerPhone ?? null, hash(token),
     input.sentAt ?? null, input.ttlDays ?? null, input.status ?? null],
  );
  const id = rows[0]!.id;
  await logSigningEvent(tx, { requestId: id, kind: 'sent', occurredAt: input.sentAt });
  return { id, token };
}

export async function logSigningEvent(
  tx: Tx,
  input: { requestId: string; kind: string; ip?: string | null; userAgent?: string | null; detail?: Record<string, unknown>; occurredAt?: Date },
): Promise<void> {
  await tx.query(
    `insert into signing_events (tenant_id, request_id, kind, ip, user_agent, detail, occurred_at)
     values (current_tenant(), $1, $2, $3, $4, coalesce($5::jsonb, '{}'), coalesce($6::timestamptz, now()))`,
    [input.requestId, input.kind, input.ip ?? null, input.userAgent ?? null,
     input.detail ? JSON.stringify(input.detail) : null, input.occurredAt ?? null],
  );
}

export async function markSigningStatus(
  tx: Tx,
  id: string,
  status: 'viewed' | 'signed' | 'declined' | 'expired' | 'void',
  opts: { at?: Date; reason?: string | null; ip?: string | null } = {},
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update signing_requests set
       status         = $2,
       viewed_at      = case when $2 = 'viewed'   then coalesce($3::timestamptz, now()) else viewed_at end,
       signed_at      = case when $2 = 'signed'   then coalesce($3::timestamptz, now()) else signed_at end,
       declined_at    = case when $2 = 'declined' then coalesce($3::timestamptz, now()) else declined_at end,
       decline_reason = case when $2 = 'declined' then $4 else decline_reason end,
       signed_ip      = case when $2 = 'signed'   then $5 else signed_ip end
     where id = $1`,
    [id, status, opts.at ?? null, opts.reason ?? null, opts.ip ?? null],
  );
  return (rowCount ?? 0) > 0;
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
