import type { Tx } from './client';

/**
 * כתיבה לזרם האירועים — עמוד השדרה של המערכת.
 * ציר הזמן, ההתראות והאודיט הם כולם צרכנים של הטבלה הזו.
 *
 * `events` מקבלת SELECT ו-INSERT בלבד ברמת ההרשאה (מיגרציה 0002),
 * ולכן append-only אינו מוסכמה שאפשר לשכוח.
 */

const EVENT_TYPE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export interface EventInput {
  type: string;
  actorType?: 'user' | 'portal_user' | 'system' | 'integration';
  actorId?: string | null;
  customerId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface StoredEvent {
  id: string;
  occurred_at: Date;
  type: string;
  actor_type: string | null;
  actor_id: string | null;
  customer_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
}

export async function publishEvent(tx: Tx, input: EventInput): Promise<string> {
  if (!EVENT_TYPE_RE.test(input.type)) {
    throw new Error(`סוג אירוע לא תקין: ${input.type} (נדרש <namespace>.<name>)`);
  }

  const { rows } = await tx.query<{ id: string }>(
    `insert into events
       (tenant_id, occurred_at, type, actor_type, actor_id, customer_id, subject_type, subject_id, payload)
     values (current_tenant(), coalesce($1, now()), $2, $3, $4, $5, $6, $7, coalesce($8, '{}'::jsonb))
     returning id`,
    [
      input.occurredAt ?? null,
      input.type,
      input.actorType ?? null,
      input.actorId ?? null,
      input.customerId ?? null,
      input.subjectType ?? null,
      input.subjectId ?? null,
      input.payload ? JSON.stringify(input.payload) : null,
    ],
  );
  return rows[0]!.id;
}

/** ציר הזמן של לקוח — החדשים ראשונים. */
export async function customerTimeline(
  tx: Tx,
  customerId: string,
  opts: { limit?: number; before?: Date; types?: string[] } = {},
): Promise<StoredEvent[]> {
  const { rows } = await tx.query<StoredEvent>(
    `select id, occurred_at, type, actor_type, actor_id, customer_id,
            subject_type, subject_id, payload
       from events
      where customer_id = $1
        and ($2::timestamptz is null or occurred_at < $2)
        and ($3::text[] is null or type = any($3))
      order by occurred_at desc, id desc
      limit $4`,
    [customerId, opts.before ?? null, opts.types ?? null, opts.limit ?? 50],
  );
  return rows;
}

/** אירועים אחרונים בכל הדייר — הבסיס לדשבורד ולדייג'סט. */
export async function recentEvents(
  tx: Tx,
  opts: { limit?: number; types?: string[] } = {},
): Promise<StoredEvent[]> {
  const { rows } = await tx.query<StoredEvent>(
    `select id, occurred_at, type, actor_type, actor_id, customer_id,
            subject_type, subject_id, payload
       from events
      where ($1::text[] is null or type = any($1))
      order by occurred_at desc, id desc
      limit $2`,
    [opts.types ?? null, opts.limit ?? 100],
  );
  return rows;
}
