import { createHash, randomBytes } from 'node:crypto';
import { withPlatform, type Tx } from './client';

/**
 * קישורי שיתוף — ראו 0014 להסבר המלא על הפער בין withPrincipal
 * (יצירה וביטול, מסלול משתמש רגיל) לפונקציית ה-SECURITY DEFINER
 * הצרה שפותרת אסימון אנונימי (פענוח, בלי זהות).
 */

const DEFAULT_TTL_DAYS = 7;

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedShare {
  token: string;
  expiresAt: Date;
}

/** מנפיקה קישור שיתוף חדש למסמך. רץ תחת withPrincipal — מסלול משתמש רגיל. */
export async function createDocumentShare(
  tx: Tx,
  input: { documentId: string; createdBy: string; ttlDays?: number },
): Promise<CreatedShare> {
  const token = newToken();
  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;

  const { rows } = await tx.query<{ expires_at: Date }>(
    `insert into document_shares (tenant_id, document_id, token_hash, created_by, expires_at)
     values (current_tenant(), $1, $2, $3, now() + make_interval(days => $4))
     returning expires_at`,
    [input.documentId, hash(token), input.createdBy, ttlDays],
  );

  return { token, expiresAt: rows[0]!.expires_at };
}

export interface ShareRow {
  id: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  last_viewed_at: Date | null;
  view_count: number;
  created_by: string;
}

/** קישורים פעילים ולא-פעילים על מסמך — לצוות, כדי לדעת מה כבר קיים ולבטל. */
export async function listDocumentShares(tx: Tx, documentId: string): Promise<ShareRow[]> {
  const { rows } = await tx.query<ShareRow>(
    `select id, created_at, expires_at, revoked_at, last_viewed_at, view_count, created_by
       from document_shares
      where document_id = $1
      order by created_at desc`,
    [documentId],
  );
  return rows;
}

export async function revokeDocumentShare(tx: Tx, shareId: string): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update document_shares set revoked_at = now() where id = $1 and revoked_at is null`,
    [shareId],
  );
  return (rowCount ?? 0) > 0;
}

export interface ResolvedShare {
  tenantId: string;
  documentId: string;
  title: string;
  filename: string;
  mime: string;
  byteSize: number | null;
  storageKey: string;
  expiresAt: Date;
}

/**
 * פענוח אסימון גולמי — הנתיב האנונימי היחיד. `withPlatform` כי עוד לא
 * ידוע הדייר; הפונקציה עצמה (SECURITY DEFINER) עושה את חציית הבידוד
 * הצרה והיחידה, בדיוק כמו `auth_resolve_session`.
 */
export async function resolveShareToken(token: string): Promise<ResolvedShare | null> {
  if (!token) return null;

  const row = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{
      tenant_id: string;
      document_id: string;
      title: string;
      filename: string;
      mime: string;
      byte_size: string | null;
      storage_key: string;
      expires_at: Date;
    }>('select * from share_resolve_token($1)', [hash(token)]);
    return rows[0] ?? null;
  });

  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    documentId: row.document_id,
    title: row.title,
    filename: row.filename,
    mime: row.mime,
    byteSize: row.byte_size ? Number(row.byte_size) : null,
    storageKey: row.storage_key,
    expiresAt: row.expires_at,
  };
}
