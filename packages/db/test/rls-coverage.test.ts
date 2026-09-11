import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, migrate, withPlatform } from '../src/index';

/**
 * שכחה היא מצב תקין של בני אדם, ולכן היא לא יכולה להיות מנגנון האבטחה.
 * הבדיקה הזו סורקת את כל הטבלאות שקיימות בפועל ונכשלת על כל אחת
 * שאין עליה בידוד — כך שטבלה חדשה בספרינט 9 לא יכולה להישכח.
 */

const hasDb = Boolean(process.env['DATABASE_URL']);

/** טבלאות שאינן שייכות לדייר, ולכן אינן אמורות לשאת מדיניות. */
const EXEMPT = new Set(['_migrations']);

/**
 * טבלאות הריאלם השלישי. אין להן `tenant_id` כי אין להן דייר — אדמין
 * הפלטפורמה אינו יושב בתוך עסק. הבידוד שלהן אינו RLS אלא הרשאות:
 * ל-`bossi_app` אין עליהן שום גישה, וזה נבדק במפורש למטה.
 */
const PLATFORM_TABLES = new Set([
  'platform_sessions', 'platform_audit', 'feature_packages',
  'platform_facebook_groups', 'platform_campaigns', 'platform_prospects',
]);
/** `tenants` היא ENABLE ולא FORCE — היא צריכה נתיב יצירה. */
const NOT_FORCED = new Set(['tenants']);

describe.skipIf(!hasDb)('כיסוי בידוד', () => {
  let tables: Array<{ name: string; rls: boolean; forced: boolean; policies: number }>;

  beforeAll(async () => {
    await migrate(() => {});
    tables = await withPlatform(async (tx) => {
      const { rows } = await tx.query<{
        name: string;
        rls: boolean;
        forced: boolean;
        policies: string;
      }>(`
        select c.relname as name,
               c.relrowsecurity as rls,
               c.relforcerowsecurity as forced,
               (select count(*) from pg_policy p where p.polrelid = c.oid)::text as policies
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
         order by c.relname
      `);
      return rows.map((r) => ({ ...r, policies: Number(r.policies) }));
    });
  }, 30_000);

  afterAll(async () => {
    await closePool();
  });

  it('נמצאו טבלאות לבדיקה', () => {
    expect(tables.length).toBeGreaterThan(5);
  });

  it('לכל טבלה של דייר יש RLS פעיל ומדיניות', () => {
    const failures = tables
      .filter((t) => !EXEMPT.has(t.name))
      .filter((t) => !t.rls || t.policies === 0)
      .map((t) => t.name);
    expect(failures, `טבלאות בלי בידוד: ${failures.join(', ')}`).toEqual([]);
  });

  it('הבידוד כופה גם על בעל הטבלה', () => {
    // בלי FORCE, בעל הסכמה עוקף את המדיניות — וב-Neon בעל הסכמה הוא בדיוק
    // מי שהאפליקציה מתחברת בתור. זו השורה שמפרידה בין בידוד לבידוד לכאורה.
    const failures = tables
      .filter((t) => !EXEMPT.has(t.name) && !NOT_FORCED.has(t.name))
      .filter((t) => !t.forced)
      .map((t) => t.name);
    expect(failures, `טבלאות בלי FORCE: ${failures.join(', ')}`).toEqual([]);
  });

  it('לטבלאות הפלטפורמה אין גישה מתפקיד האפליקציה', async () => {
    // זה החסם האמיתי עליהן. הרשאה נבדקת לפני מדיניות, ולכן היעדר
    // GRANT חזק מכל policy שאפשר לכתוב.
    const grants = await withPlatform(async (tx) => {
      const { rows } = await tx.query<{ table_name: string; privilege_type: string }>(
        `select table_name, privilege_type from information_schema.role_table_grants
          where grantee = 'bossi_app' and table_name = any($1)`,
        [[...PLATFORM_TABLES]],
      );
      return rows.map((r) => `${r.table_name}.${r.privilege_type}`);
    });
    expect(grants, `הרשאות שלא אמורות להתקיים: ${grants.join(', ')}`).toEqual([]);
  });

  it('לכל טבלה של דייר יש עמודת tenant_id', async () => {
    const missing = await withPlatform(async (tx) => {
      const { rows } = await tx.query<{ name: string }>(`
        select c.relname as name
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
           and c.relname not in (
             '_migrations', 'tenants', 'platform_sessions', 'platform_audit', 'feature_packages',
             'platform_facebook_groups', 'platform_campaigns', 'platform_prospects'
           )
           and not exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid and a.attname = 'tenant_id' and a.attnum > 0
           )
      `);
      return rows.map((r) => r.name);
    });
    expect(missing, `טבלאות בלי tenant_id: ${missing.join(', ')}`).toEqual([]);
  });

  it('ל-bossi_app אין הרשאת שינוי על events', async () => {
    const grants = await withPlatform(async (tx) => {
      const { rows } = await tx.query<{ privilege_type: string }>(
        `select privilege_type from information_schema.role_table_grants
          where grantee = 'bossi_app' and table_name = 'events'`,
      );
      return rows.map((r) => r.privilege_type).sort();
    });
    expect(grants).toEqual(['INSERT', 'SELECT']);
  });

  it('ל-bossi_app אין BYPASSRLS', async () => {
    const bypass = await withPlatform(async (tx) => {
      const { rows } = await tx.query<{ rolbypassrls: boolean }>(
        `select rolbypassrls from pg_roles where rolname = 'bossi_app'`,
      );
      return rows[0]!.rolbypassrls;
    });
    expect(bypass).toBe(false);
  });
});
