import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { withPlatform } from './client';

/**
 * אימות אדמין הפלטפורמה — הריאלם השלישי.
 *
 * זהו הנתיב היחיד במערכת שמשתמש בסיסמה. הצוות נכנס בקישור חד-פעמי כי
 * אין שם מה לגנוב; כאן אין למי לשלוח קישור, כי האדמין אינו רשומה במסד
 * אלא הגדרה בסביבה.
 *
 * שלושה דברים שסיסמה מחייבת ושקישור לא:
 *
 *   · **scrypt ולא SHA.** גיבוב מהיר הופך דליפה של ה-hash לניחוש של
 *     שניות. scrypt יקר בזיכרון ובזמן במכוון.
 *   · **הגבלת קצב.** קישור חד-פעמי אי אפשר לנחש; סיסמה כן. חמישה
 *     כשלונות מאותו IP נועלים לרבע שעה.
 *   · **השוואה בזמן קבוע**, כדי שזמן התגובה לא יסגיר כמה תווים נכונים.
 */

/**
 * `promisify` לא מצליח לבחור את הגרסה עם אפשרויות מתוך העומסים של
 * `scrypt`, ולכן העטיפה מפורשת. חתימה מפורשת עדיפה כאן על `any`.
 */
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SESSION_TTL_HOURS = 8;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** פרמטרי scrypt. N=16384 הוא ~50ms — כבד מספיק לתוקף, זניח למשתמש. */
const SCRYPT = { N: 16_384, r: 8, p: 1, keylen: 32 } as const;

export interface PlatformAdmin {
  email: string;
  /** מסומן כדי שאף קוד לא יבלבל בין זהות פלטפורמה לזהות של דייר. */
  realm: 'platform';
}

// ── סיסמאות ───────────────────────────────────────────────────────────────

/**
 * מייצר `scrypt$<salt>$<hash>` — הפורמט שנכנס ל-ENV.
 *
 * המלח נשמר בתוך המחרוזת ולא בנפרד: משתנה סביבה אחד קל להעתיק נכון,
 * ושניים קל להעתיק חצי.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/**
 * מאמת סיסמה מול ה-hash שב-ENV.
 *
 * מחזיר false על כל תקלה — פורמט שגוי, hash חסר, אורך לא תואם — ולעולם
 * לא זורק. שגיאה שמתפרשת כהצלחה היא בדיוק סוג הבאג שפותח דלת.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const salt = Buffer.from(parts[1]!, 'base64url');
  const expected = Buffer.from(parts[2]!, 'base64url');
  if (salt.length === 0 || expected.length !== SCRYPT.keylen) return false;

  try {
    const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// ── ההגדרה שבסביבה ────────────────────────────────────────────────────────

export interface AdminCredentials {
  email: string;
  passwordHash: string;
}

/**
 * הזהות המוגדרת בסביבה. `null` = קונסולת הניהול **כבויה לגמרי**,
 * וכל נתיב תחתיה מחזיר 404.
 *
 * זו נקודת הכיבוי: מחיקת שני המשתנים סוגרת את הדלת בלי לפרוס קוד.
 */
export function adminCredentials(): AdminCredentials | null {
  const email = process.env['PLATFORM_ADMIN_EMAIL']?.trim();
  const passwordHash = process.env['PLATFORM_ADMIN_PASSWORD_HASH']?.trim();
  if (!email || !passwordHash) return null;
  return { email, passwordHash };
}

// ── התחברות ───────────────────────────────────────────────────────────────

export type SignInResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: 'disabled' | 'bad_credentials' | 'locked'; retryAfterMinutes?: number };

export async function signInPlatform(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SignInResult> {
  const credentials = adminCredentials();
  if (!credentials) return { ok: false, reason: 'disabled' };

  if (await isLocked(input.ip)) {
    return { ok: false, reason: 'locked', retryAfterMinutes: LOCKOUT_MINUTES };
  }

  // שתי הבדיקות רצות תמיד ובאותו סדר: יציאה מוקדמת על כתובת שגויה
  // מסגירה דרך זמן התגובה איזו כתובת נכונה.
  const emailOk = safeEqual(input.email.trim().toLowerCase(), credentials.email.toLowerCase());
  const passwordOk = await verifyPassword(input.password, credentials.passwordHash);

  if (!emailOk || !passwordOk) {
    await recordAudit({
      kind: 'login_failed',
      email: input.email.slice(0, 200),
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { ok: false, reason: 'bad_credentials' };
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000);

  await withPlatform(async (tx) => {
    await tx.query(
      `insert into platform_sessions (email, token_hash, expires_at, ip, user_agent)
       values ($1, $2, $3, $4, $5)`,
      [credentials.email, sha256(token), expiresAt, input.ip ?? null, input.userAgent ?? null],
    );
  });

  await recordAudit({
    kind: 'login_ok',
    email: credentials.email,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true, token, expiresAt };
}

/**
 * מפענח עוגיית אדמין.
 *
 * בודק גם שהכתובת בחיבור עדיין תואמת ל-ENV: שינוי `PLATFORM_ADMIN_EMAIL`
 * או מחיקתו מנתקים מיד כל חיבור פתוח, בלי צורך למחוק שורות.
 */
export async function resolvePlatformSession(token: string): Promise<PlatformAdmin | null> {
  if (!token) return null;
  const credentials = adminCredentials();
  if (!credentials) return null;

  const row = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{ email: string }>(
      `update platform_sessions set last_seen_at = now()
        where token_hash = $1 and expires_at > now()
        returning email`,
      [sha256(token)],
    );
    return rows[0] ?? null;
  });

  if (!row) return null;
  if (row.email.toLowerCase() !== credentials.email.toLowerCase()) return null;

  return { email: row.email, realm: 'platform' };
}

export async function signOutPlatform(token: string): Promise<void> {
  if (!token) return;
  await withPlatform((tx) =>
    tx.query('delete from platform_sessions where token_hash = $1', [sha256(token)]),
  );
}

// ── הגבלת קצב ─────────────────────────────────────────────────────────────

/**
 * נעילה לפי IP. לא לפי כתובת מייל — התוקף שולט בכתובת שהוא שולח, ולכן
 * נעילה לפיה נעקפת בשינוי תו אחד.
 */
async function isLocked(ip: string | null | undefined): Promise<boolean> {
  if (!ip) return false;
  const { rows } = await withPlatform((tx) =>
    tx.query<{ n: string }>(
      `select count(*)::text as n from platform_audit
        where kind = 'login_failed' and ip = $1 and at > now() - make_interval(mins => $2)`,
      [ip, LOCKOUT_MINUTES],
    ),
  );
  return Number(rows[0]?.n ?? 0) >= LOCKOUT_ATTEMPTS;
}

// ── תיעוד ─────────────────────────────────────────────────────────────────

export async function recordAudit(input: {
  kind: string;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  tenantId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await withPlatform((tx) =>
    tx.query(
      `insert into platform_audit (kind, email, ip, user_agent, tenant_id, detail)
       values ($1, $2, $3, $4, $5, coalesce($6::jsonb, '{}'))`,
      [
        input.kind, input.email ?? null, input.ip ?? null, input.userAgent ?? null,
        input.tenantId ?? null, input.detail ? JSON.stringify(input.detail) : null,
      ],
    ),
  );
}

export interface AuditRow {
  id: string;
  at: Date;
  kind: string;
  email: string | null;
  ip: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  detail: Record<string, unknown>;
}

export async function recentAudit(limit = 50): Promise<AuditRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<AuditRow>(
      `select a.id::text, a.at, a.kind, a.email, a.ip, a.tenant_id, t.name as tenant_name, a.detail
         from platform_audit a
         left join tenants t on t.id = a.tenant_id
        order by a.at desc limit $1`,
      [limit],
    ),
  );
  return rows;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
