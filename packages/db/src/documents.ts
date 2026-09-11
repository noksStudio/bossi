import type { Tx } from './client';

/**
 * שכבת המסמכים. כמו בשאר השאילתות — אין כאן `where tenant_id`,
 * כי הבידוד הוא של המסד ולא של הקוד.
 */

export const DOC_TYPES = {
  contract: 'חוזה',
  quote: 'הצעת מחיר',
  invoice: 'חשבונית',
  receipt: 'קבלה',
  delivery_note: 'תעודת משלוח',
  tax_exemption: 'אישור ניכוי מס במקור',
  insurance: 'אישור ביטוח',
  bank_guarantee: 'ערבות בנקאית',
  meeting_notes: 'סיכום פגישה',
  correspondence: 'תכתובת',
  other: 'אחר',
} as const;

export type DocType = keyof typeof DOC_TYPES;

export const SOURCES = {
  email: 'מייל',
  whatsapp: 'WhatsApp',
  scan: 'סריקה',
  upload: 'העלאה',
  sync: 'סנכרון',
} as const;

export interface DocumentRow {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  title: string;
  filename: string;
  mime: string;
  byte_size: string | null;
  storage_key: string;
  source: string;
  doc_type: string | null;
  doc_type_confidence: number | null;
  status: string;
  issued_on: Date | null;
  expires_on: Date | null;
  amount: string | null;
  created_at: Date;
}

const SELECT = `
  select d.id, d.customer_id, c.display_name as customer_name, d.title, d.filename,
         d.mime, d.byte_size::text, d.storage_key, d.source, d.doc_type,
         d.doc_type_confidence, d.status, d.issued_on, d.expires_on,
         d.amount::text, d.created_at
    from documents d
    left join customers c on c.id = d.customer_id
`;

export interface DocumentFilters {
  customerId?: string;
  docType?: string;
  source?: string;
  status?: string;
  search?: string;
  expiringWithinDays?: number;
  limit?: number;
}

export async function listDocuments(tx: Tx, f: DocumentFilters = {}): Promise<DocumentRow[]> {
  const { rows } = await tx.query<DocumentRow>(
    `${SELECT}
      where ($1::uuid is null or d.customer_id = $1)
        and ($2::text is null or d.doc_type = $2)
        and ($3::text is null or d.source = $3)
        and ($4::text is null or d.status = $4)
        and ($5::text is null or d.search_text @@ plainto_tsquery('simple', $5) or d.title ilike '%' || $5 || '%')
        and ($6::int is null or (d.expires_on is not null and d.expires_on <= current_date + $6::int))
      order by d.created_at desc
      limit $7`,
    [
      f.customerId ?? null,
      f.docType ?? null,
      f.source ?? null,
      f.status ?? null,
      f.search?.trim() || null,
      f.expiringWithinDays ?? null,
      f.limit ?? 100,
    ],
  );
  return rows;
}

export async function getDocument(tx: Tx, id: string): Promise<DocumentRow | null> {
  const { rows } = await tx.query<DocumentRow>(`${SELECT} where d.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createDocument(
  tx: Tx,
  input: {
    title: string;
    filename: string;
    storageKey: string;
    customerId?: string | null;
    docType?: string | null;
    confidence?: number | null;
    source?: string;
    status?: string;
    issuedOn?: string | null;
    expiresOn?: string | null;
    amount?: string | null;
    byteSize?: number | null;
    mime?: string;
    contentHash?: string | null;
    createdAt?: Date;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into documents
       (tenant_id, customer_id, title, filename, storage_key, content_hash, doc_type,
        doc_type_confidence, source, status, issued_on, expires_on, amount, byte_size,
        mime, created_at)
     values (current_tenant(), $1, $2, $3, $4, $5, $6,
             $7, coalesce($8, 'upload'), coalesce($9, 'filed'), $10, $11, $12, $13,
             coalesce($14, 'application/pdf'), coalesce($15, now()))
     returning id`,
    [
      input.customerId ?? null,
      input.title,
      input.filename,
      input.storageKey,
      input.contentHash ?? null,
      input.docType ?? null,
      input.confidence ?? null,
      input.source ?? null,
      input.status ?? null,
      input.issuedOn ?? null,
      input.expiresOn ?? null,
      input.amount ?? null,
      input.byteSize ?? null,
      input.mime ?? null,
      input.createdAt ?? null,
    ],
  );
  return rows[0]!.id;
}

/**
 * מסמך קיים עם אותו תוכן בדיוק — hash לפני עיבוד (CLAUDE.md "תמיד").
 * משמש לייבוא: קובץ שכבר הועלה פעם לא נכתב שוב לאחסון, רק השורה
 * החדשה מצביעה על אותו `storage_key`.
 */
export async function findDocumentByHash(tx: Tx, contentHash: string): Promise<DocumentRow | null> {
  const { rows } = await tx.query<DocumentRow>(`${SELECT} where d.content_hash = $1 limit 1`, [contentHash]);
  return rows[0] ?? null;
}

/**
 * שיוך/ביטול שיוך ידני ללקוח — תמיד ניתן לעריכה, גם אחרי שיוך
 * אוטומטי (ספרינט ד׳). `null` מסיר שיוך ("לא משויך").
 */
export async function setDocumentCustomer(tx: Tx, id: string, customerId: string | null): Promise<boolean> {
  const { rowCount } = await tx.query('update documents set customer_id = $2 where id = $1', [id, customerId]);
  return (rowCount ?? 0) > 0;
}

/**
 * שינוי סוג ידני — אדם שבחר סוג בעצמו הוא הוודאות הגבוהה ביותר
 * שיש, ולכן confidence עולה ל-1 והסטטוס יוצא מ-needs_review אם
 * זו הייתה הסיבה היחידה שהוא היה שם.
 */
export async function setDocumentType(tx: Tx, id: string, docType: string): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update documents
        set doc_type = $2, doc_type_confidence = 1,
            status = case when status = 'needs_review' then 'filed' else status end
      where id = $1`,
    [id, docType],
  );
  return (rowCount ?? 0) > 0;
}

/** מסמכים חיים שתוקפם עומד לפוג — מזין את "דורש תשומת לב". */
export async function expiringDocuments(tx: Tx, withinDays = 60): Promise<DocumentRow[]> {
  const { rows } = await tx.query<DocumentRow>(
    `${SELECT}
      where d.expires_on is not null
        and d.expires_on <= current_date + $1::int
        and d.status <> 'archived'
      order by d.expires_on
      limit 20`,
    [withinDays],
  );
  return rows;
}

/** מה שנקלט לאחרונה — סיפור הריכוז, ויזואלית. */
export async function recentIntake(tx: Tx, limit = 8): Promise<DocumentRow[]> {
  const { rows } = await tx.query<DocumentRow>(
    `${SELECT} where d.source <> 'upload' order by d.created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function documentStats(tx: Tx): Promise<{
  total: number;
  this_month: number;
  needs_review: number;
  expiring_soon: number;
}> {
  const { rows } = await tx.query<Record<string, string>>(
    `select count(*)::text as total,
            count(*) filter (where created_at >= date_trunc('month', now()))::text as this_month,
            count(*) filter (where status = 'needs_review')::text as needs_review,
            count(*) filter (where expires_on is not null and expires_on <= current_date + 60)::text as expiring_soon
       from documents`,
  );
  const r = rows[0]!;
  return {
    total: Number(r['total']),
    this_month: Number(r['this_month']),
    needs_review: Number(r['needs_review']),
    expiring_soon: Number(r['expiring_soon']),
  };
}

/** לקוחות שלא היה איתם שום אירוע זמן רב — "מי נשכח". */
export async function quietCustomers(tx: Tx, days = 60, limit = 6) {
  const { rows } = await tx.query<{ id: string; display_name: string; last_seen: Date | null; days_quiet: number }>(
    `select c.id, c.display_name,
            max(e.occurred_at) as last_seen,
            coalesce(extract(day from now() - max(e.occurred_at))::int, 999) as days_quiet
       from customers c
       left join events e on e.customer_id = c.id
      where c.status = 'active'
      group by c.id, c.display_name
     having max(e.occurred_at) is null or max(e.occurred_at) < now() - make_interval(days => $1)
      order by max(e.occurred_at) asc nulls first
      limit $2`,
    [days, limit],
  );
  return rows;
}

export interface SearchHit {
  kind: 'document' | 'customer';
  id: string;
  title: string;
  subtitle: string | null;
  doc_type: string | null;
  created_at: Date | null;
}

/**
 * חיפוש על פני מסמכים ולקוחות.
 *
 * FTS תופס מילים שלמות, trigram תופס שגיאות כתיב וחלקי מילים. שניהם
 * יחד כי בעברית אין גזירת שורש ב-Postgres, ומילה אחת יכולה להופיע
 * בחמש צורות.
 */
export async function search(tx: Tx, query: string, limit = 40): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const { rows } = await tx.query<SearchHit>(
    `select 'document' as kind, d.id, d.title,
            c.display_name as subtitle, d.doc_type, d.created_at
       from documents d
       left join customers c on c.id = d.customer_id
      where d.search_text @@ plainto_tsquery('simple', $1)
         or d.title ilike '%' || $1 || '%'
     union all
     select 'customer', c.id, c.display_name,
            c.legal_name, null, c.created_at
       from customers c
      where c.display_name ilike '%' || $1 || '%'
         or c.legal_name ilike '%' || $1 || '%'
         or c.business_id like $1 || '%'
      limit $2`,
    [q, limit],
  );
  return rows;
}
