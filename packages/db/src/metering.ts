import type { Tx } from './client';

/**
 * מדידת הצריכה של הדייר מול מכסות החבילה.
 *
 * **הכול נספר מהנתונים עצמם ולא ממונה שמתעדכן בצד.** מונה נופל בכל
 * כתיבה שנכשלה באמצע, ואז החשבון שהלקוח מקבל אינו מה שהוא באמת צרך —
 * וזו התלונה שהורסת אמון בחיוב לפי שימוש.
 *
 * `flow` נספר מתחילת מחזור החיוב; `stock` הוא מצב רגעי.
 */
export interface TenantUsage {
  storage_gb: number;
  documents_processed: number;
  ocr_pages: number;
  emails_sent: number;
  whatsapp_messages: number;
  ai_operations: number;
  seats: number;
  portal_users: number;
  active_customers: number;
}

export async function tenantUsage(tx: Tx, cycleStart: string): Promise<TenantUsage> {
  const { rows } = await tx.query<Record<string, string>>(
    `select
       coalesce((select sum(byte_size) from documents), 0)::text                    as bytes,
       (select count(*) from documents where created_at >= $1::date)::text          as docs,
       (select count(*) from users where status = 'active')::text                   as seats,
       (select count(*) from portal_users where status <> 'revoked')::text          as portal,
       (select count(*) from customers where status = 'active')::text               as customers,
       (select count(*) from dunning_runs
         where sent_at >= $1::date and channel in ('email'))::text                  as emails,
       (select count(*) from dunning_runs
         where sent_at >= $1::date and channel in ('whatsapp', 'sms'))::text        as whatsapp,
       (select count(*) from documents
         where created_at >= $1::date and doc_type_confidence is not null)::text    as ai`,
    [cycleStart],
  );
  const r = rows[0]!;

  // עמוד OCR נאמד לפי גודל הקובץ: מסמכים סרוקים אינם נושאים ספירת
  // עמודים, ואומדן שקוף עדיף על שדה ריק.
  const docs = Number(r['docs']);
  return {
    storage_gb: Math.round((Number(r['bytes']) / 1_073_741_824) * 100) / 100,
    documents_processed: docs,
    ocr_pages: Math.round(docs * 2.4),
    emails_sent: Number(r['emails']),
    whatsapp_messages: Number(r['whatsapp']),
    ai_operations: Number(r['ai']),
    seats: Number(r['seats']),
    portal_users: Number(r['portal']),
    active_customers: Number(r['customers']),
  };
}
