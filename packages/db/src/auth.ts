import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { withPlatform, withPrincipal, type Tx } from './client';

/**
 * שכבת האימות. עולם הצוות בלבד — משתמשי פורטל יקבלו שכבה נפרדת
 * בספרינט 13, עם עוגייה נפרדת ו-middleware נפרד (CLAUDE.md כלל 2).
 *
 * האסימונים עצמם לעולם לא נשמרים. במסד יושב רק SHA-256 שלהם, ולכן
 * גיבוי שדלף אינו מאפשר התחברות.
 */

const LOGIN_TTL_MINUTES = 20;
const SESSION_TTL_DAYS = 30;

export interface Principal {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'staff' | 'bookkeeper';
}

/** 32 בתים אקראיים ב-base64url. ~256 ביט אנטרופיה. */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * משווה בזמן קבוע. משמש היכן שהשוואת מחרוזות עלולה להסגיר מידע
 * דרך זמן התגובה.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface LoginRequest {
  /** האסימון הגולמי — נשלח למשתמש ואינו נשמר בשום מקום. */
  token: string;
  tenantId: string;
  expiresAt: Date;
}

/**
 * מנפיק קישור התחברות.
 *
 * מחזיר `null` כשאין משתמש פעיל יחיד עם הכתובת — והקורא **חייב** להציג
 * את אותה תשובה בדיוק גם במקרה הזה. אחרת מסך ההתחברות הופך לכלי
 * לבדוק מי לקוח שלנו.
 */
export async function requestLogin(email: string): Promise<LoginRequest | null> {
  const token = newToken();
  const tenantId = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{ auth_issue_login_token: string | null }>(
      'select auth_issue_login_token($1, $2, make_interval(mins => $3))',
      [email, hash(token), LOGIN_TTL_MINUTES],
    );
    return rows[0]?.auth_issue_login_token ?? null;
  });

  if (!tenantId) return null;
  return {
    token,
    tenantId,
    expiresAt: new Date(Date.now() + LOGIN_TTL_MINUTES * 60_000),
  };
}

export interface SessionCreated {
  token: string;
  tenantId: string;
  userId: string;
  expiresAt: Date;
}

/** ממיר אסימון התחברות לחיבור. חד-פעמי. */
export async function consumeLoginToken(
  loginToken: string,
  userAgent?: string,
): Promise<SessionCreated | null> {
  const sessionToken = newToken();
  const row = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{ tenant_id: string; user_id: string }>(
      'select * from auth_consume_login_token($1, $2, make_interval(days => $3), $4)',
      [hash(loginToken), hash(sessionToken), SESSION_TTL_DAYS, userAgent ?? null],
    );
    return rows[0] ?? null;
  });

  if (!row) return null;
  return {
    token: sessionToken,
    tenantId: row.tenant_id,
    userId: row.user_id,
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
  };
}

/** מפענח עוגייה לזהות. רץ בכל בקשה מוגנת. */
export async function resolveSession(sessionToken: string): Promise<Principal | null> {
  if (!sessionToken) return null;

  const row = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{
      tenant_id: string;
      tenant_slug: string;
      tenant_name: string;
      user_id: string;
      user_email: string;
      user_name: string;
      user_role: Principal['role'];
    }>('select * from auth_resolve_session($1)', [hash(sessionToken)]);
    return rows[0] ?? null;
  });

  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    userId: row.user_id,
    email: row.user_email,
    name: row.user_name,
    role: row.user_role,
  };
}

/**
 * חיבור דמו. הרשימה המותרת מגיעה מהסביבה, והמסד בודק שוב שהדייר
 * אכן מסומן כדמו — שני מנעולים בלתי תלויים.
 */
export async function createDemoSession(slug: string): Promise<SessionCreated | null> {
  const allowed = (process.env['DEMO_TENANT_SLUGS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.includes(slug)) return null;

  const token = newToken();
  const row = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{ tenant_id: string; user_id: string }>(
      'select * from auth_demo_session($1, $2)',
      [slug, hash(token)],
    );
    return rows[0] ?? null;
  });

  if (!row) return null;
  return {
    token,
    tenantId: row.tenant_id,
    userId: row.user_id,
    expiresAt: new Date(Date.now() + 12 * 3_600_000),
  };
}

/** הדיירים שמותר להיכנס אליהם כדמו. ריק = כניסת הדמו כבויה. */
export function demoTenants(): string[] {
  return (process.env['DEMO_TENANT_SLUGS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await withPlatform((tx) => tx.query('select auth_revoke_session($1)', [hash(sessionToken)]));
}

export async function purgeExpired(): Promise<number> {
  return withPlatform(async (tx) => {
    const { rows } = await tx.query<{ auth_purge_expired: number }>('select auth_purge_expired()');
    return rows[0]?.auth_purge_expired ?? 0;
  });
}

/**
 * מריץ עבודה בהקשר של המשתמש המחובר.
 *
 * זו הדרך היחידה שקוד של מסך ניגש למסד: הזהות מגיעה מהעוגייה ולא
 * מפרמטר שהדפדפן שולט בו, והיא מועברת למסד — כך שגם ההרשאות נאכפות
 * שם ולא רק בממשק.
 */
export async function asPrincipal<T>(
  principal: Principal,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return withPrincipal(
    { tenantId: principal.tenantId, userId: principal.userId, role: principal.role },
    fn,
  );
}
