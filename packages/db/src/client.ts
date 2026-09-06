import pg from 'pg';

/**
 * שני נתיבי גישה למסד, ורק שניים.
 *
 *   withTenant()   — כל בקשה של האפליקציה. רץ תחת `bossi_app` עם דייר מוגדר.
 *   withPlatform() — פעולות שאינן שייכות לדייר (יצירת דייר, מיגרציות, seed).
 *                    רץ תחת בעל הסכמה. **כל שימוש בו הוא החלטה מודעת.**
 *
 * אין נתיב שלישי. גישה ישירה ל-pool מחוץ לקובץ הזה עוקפת את הבידוד.
 */

const { Pool } = pg;

// כסף מגיע כ-numeric ואסור שיהפוך ל-float בדרך.
pg.types.setTypeParser(1700, (v) => v);
// int8 (מזהי אירועים) — כמחרוזת, כדי לא לאבד דיוק מעל 2^53.
pg.types.setTypeParser(20, (v) => v);

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) throw new Error('DATABASE_URL אינו מוגדר');
    pool = new Pool({
      connectionString,
      max: Number(process.env['DATABASE_POOL_MAX'] ?? 10),
      idleTimeoutMillis: 30_000,
      ...(connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? {}
        : { ssl: { rejectUnauthorized: true } }),
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export interface Tx {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<pg.QueryResult<R>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * מריץ עבודה בהקשר של דייר יחיד.
 *
 * `set_config(..., true)` מקבל פרמטר — ולכן מזהה הדייר לעולם לא משורשר לתוך SQL.
 * ה-`true` הופך את ההגדרה למקומית לטרנזקציה, כך שהיא נעלמת עם ה-COMMIT
 * ולא דולפת לבקשה הבאה שתקבל את אותו חיבור מה-pool.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) throw new Error(`מזהה דייר לא תקין: ${tenantId}`);

  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('set local role bossi_app');
    await client.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * עוקף את בידוד הדיירים. מיועד ליצירת דיירים, מיגרציות ו-seed בלבד.
 *
 * אם אתם קוראים לזה בתוך טיפול בבקשת משתמש — כמעט בוודאות זו טעות.
 */
export async function withPlatform<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** יוצר דייר דרך הנתיב היחיד שקיים לכך. */
export async function createTenant(input: {
  slug: string;
  name: string;
  plan?: 'starter' | 'pro' | 'mega';
  modules?: readonly string[];
  businessId?: string | null;
}): Promise<string> {
  return withPlatform(async (tx) => {
    const { rows } = await tx.query<{ platform_create_tenant: string }>(
      'select platform_create_tenant($1, $2, $3, $4, $5)',
      [input.slug, input.name, input.plan ?? 'starter', input.modules ?? [], input.businessId ?? null],
    );
    return rows[0]!.platform_create_tenant;
  });
}
