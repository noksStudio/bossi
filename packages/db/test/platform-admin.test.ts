import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  adminCredentials, closePool, migrate, recordAudit,
  resolvePlatformSession, signInPlatform, signOutPlatform, withPlatform,
} from '../src/index';

/**
 * הריאלם השלישי. הבדיקות כאן שואלות דבר אחד: **האם הדלת נסגרת.**
 *
 * הסיסמה יושבת בסביבה כמות שהיא ולא כ-hash (ADR-009) — הבדיקות כאן
 * לא בודקות גיבוב אלא את מה שכן קיים: השוואה מדויקת, הגבלת קצב,
 * וניתוק מיידי כשהסביבה משתנה.
 */

const hasDb = Boolean(process.env['DATABASE_URL']);
const PASSWORD = 'correct-horse-battery-staple';
const EMAIL = 'admin@bossi.test';

describe('הקונסולה כבויה כברירת מחדל', () => {
  it('בלי משתני סביבה אין אדמין בכלל', () => {
    delete process.env['PLATFORM_ADMIN_EMAIL'];
    delete process.env['PLATFORM_ADMIN_PASSWORD'];
    expect(adminCredentials()).toBeNull();
  });

  it('משתנה אחד בלבד אינו מספיק', () => {
    process.env['PLATFORM_ADMIN_EMAIL'] = EMAIL;
    delete process.env['PLATFORM_ADMIN_PASSWORD'];
    expect(adminCredentials()).toBeNull();

    delete process.env['PLATFORM_ADMIN_EMAIL'];
    process.env['PLATFORM_ADMIN_PASSWORD'] = PASSWORD;
    expect(adminCredentials()).toBeNull();
  });

  it('הסיסמה בסביבה נקראת כמות שהיא — רק הכתובת נחתכת', () => {
    process.env['PLATFORM_ADMIN_EMAIL'] = `  ${EMAIL}  `;
    process.env['PLATFORM_ADMIN_PASSWORD'] = ` ${PASSWORD} `;
    expect(adminCredentials()).toEqual({ email: EMAIL, password: ` ${PASSWORD} ` });
    delete process.env['PLATFORM_ADMIN_EMAIL'];
    delete process.env['PLATFORM_ADMIN_PASSWORD'];
  });
});

describe.skipIf(!hasDb)('התחברות אדמין', () => {
  beforeAll(async () => {
    await migrate(() => {});
    process.env['PLATFORM_ADMIN_EMAIL'] = EMAIL;
    process.env['PLATFORM_ADMIN_PASSWORD'] = PASSWORD;
  }, 30_000);

  beforeEach(async () => {
    await withPlatform(async (tx) => {
      await tx.query('delete from platform_sessions');
      // הטריגר חוסם DELETE גם מנתיב הפלטפורמה — וזו בדיוק הנקודה.
      // ניקוי בין בדיקות דורש להשבית אותו במפורש.
      await tx.query('alter table platform_audit disable trigger platform_audit_no_change');
      await tx.query('delete from platform_audit');
      await tx.query('alter table platform_audit enable trigger platform_audit_no_change');
    });
  });

  afterAll(async () => {
    delete process.env['PLATFORM_ADMIN_EMAIL'];
    delete process.env['PLATFORM_ADMIN_PASSWORD'];
    await closePool();
  });

  it('פרטים נכונים פותחים חיבור', async () => {
    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '1.1.1.1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const admin = await resolvePlatformSession(result.token);
    expect(admin).toEqual({ email: EMAIL, realm: 'platform' });
  });

  it('סיסמה שגויה אינה פותחת דבר', async () => {
    const result = await signInPlatform({ email: EMAIL, password: 'wrong', ip: '2.2.2.2' });
    expect(result).toEqual({ ok: false, reason: 'bad_credentials' });
  });

  it('סיסמה קרובה אך לא זהה נדחית', async () => {
    const result = await signInPlatform({
      email: EMAIL, password: PASSWORD.slice(0, -1), ip: '2.2.2.3',
    });
    expect(result).toEqual({ ok: false, reason: 'bad_credentials' });
  });

  it('כתובת שגויה אינה פותחת דבר — גם עם הסיסמה הנכונה', async () => {
    const result = await signInPlatform({ email: 'someone@else.com', password: PASSWORD, ip: '3.3.3.3' });
    expect(result).toEqual({ ok: false, reason: 'bad_credentials' });
  });

  it('חמישה כשלונות מאותו IP נועלים', async () => {
    for (let i = 0; i < 5; i++) {
      await signInPlatform({ email: EMAIL, password: 'wrong', ip: '4.4.4.4' });
    }
    // גם עם הסיסמה הנכונה — הנעילה קודמת לבדיקה.
    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '4.4.4.4' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('locked');
  });

  it('הנעילה היא לפי IP ולא חוסמת אחרים', async () => {
    for (let i = 0; i < 5; i++) {
      await signInPlatform({ email: EMAIL, password: 'wrong', ip: '5.5.5.5' });
    }
    const other = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '6.6.6.6' });
    expect(other.ok).toBe(true);
  });

  it('אסימון מומצא אינו מזהה איש', async () => {
    expect(await resolvePlatformSession('made-up-token')).toBeNull();
    expect(await resolvePlatformSession('')).toBeNull();
  });

  it('יציאה מבטלת את החיבור מיד', async () => {
    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '7.7.7.7' });
    if (!result.ok) throw new Error('ההתחברות נכשלה');

    await signOutPlatform(result.token);
    expect(await resolvePlatformSession(result.token)).toBeNull();
  });

  it('חיבור שפג אינו מזהה איש', async () => {
    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '8.8.8.8' });
    if (!result.ok) throw new Error('ההתחברות נכשלה');

    await withPlatform((tx) =>
      tx.query("update platform_sessions set expires_at = now() - interval '1 minute'"),
    );
    expect(await resolvePlatformSession(result.token)).toBeNull();
  });

  it('שינוי הכתובת בסביבה מנתק חיבורים פתוחים', async () => {
    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '9.9.9.9' });
    if (!result.ok) throw new Error('ההתחברות נכשלה');

    process.env['PLATFORM_ADMIN_EMAIL'] = 'someone-else@bossi.test';
    expect(await resolvePlatformSession(result.token)).toBeNull();
    process.env['PLATFORM_ADMIN_EMAIL'] = EMAIL;
  });

  it('כיבוי הקונסולה מנתק חיבורים פתוחים', async () => {
    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '10.10.10.10' });
    if (!result.ok) throw new Error('ההתחברות נכשלה');

    const saved = process.env['PLATFORM_ADMIN_PASSWORD'];
    delete process.env['PLATFORM_ADMIN_PASSWORD'];
    expect(await resolvePlatformSession(result.token)).toBeNull();
    process.env['PLATFORM_ADMIN_PASSWORD'] = saved;
  });

  it('התיעוד אינו ניתן לשינוי או למחיקה — גם מנתיב הפלטפורמה', async () => {
    await recordAudit({ kind: 'login_ok', email: EMAIL });
    await expect(
      withPlatform((tx) => tx.query("update platform_audit set kind = 'tampered'")),
    ).rejects.toThrow();
    await expect(
      withPlatform((tx) => tx.query('delete from platform_audit')),
    ).rejects.toThrow();
  });

  it('התחברות ראשונה על מסד חדש מריצה את המיגרציה החסרה לבד', async () => {
    // זה בדיוק הבאג שהתגלה בפריסה: מסד שבו 0011 עוד לא רץ — המצב
    // הטבעי של כל מסד ייצור עד לרגע זה — אין דרך להריץ אותה חוץ מדרך
    // קונסולת הניהול, ואין דרך להיכנס לקונסולה בלי ש-0011 כבר רץ.
    // בלי תיקון, הניסיון הבא זורק "relation does not exist" וקורס ב-500.
    await withPlatform(async (tx) => {
      await tx.query('drop table if exists platform_audit cascade');
      await tx.query('drop table if exists platform_sessions cascade');
      await tx.query(
        // 0013 מחליף פונקציה שנוצרת ב-0011 (הטבלה שנמחקה למעלה) — בלי
        // למחוק גם את הרשומה שלה כאן, replay שמריץ רק 0011 מחדש היה
        // מחזיר את הפונקציה לגרסה הישנה שלה. מסד שבאמת מעולם לא הריץ
        // 0011 גם מעולם לא הגיע ל-0013 בפועל, אז זו הסימולציה הנאמנה.
        "delete from _migrations where name in ('0011_platform_admin.sql', '0013_platform_audit_tenant_cascade.sql')",
      );
    });

    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '11.11.11.11' });
    expect(result.ok).toBe(true);

    // והמסד לא רק "לא קרס" — הוא באמת חזר לשלם: שתי הטבלאות קיימות
    // מחדש, וההתחברות שהתבקשה בפועל נכתבה בהן.
    const tables = await withPlatform((tx) =>
      tx.query<{ n: string }>(
        `select count(*)::text as n from pg_tables
          where tablename in ('platform_sessions', 'platform_audit')`,
      ),
    );
    expect(tables.rows[0]?.n).toBe('2');

    if (result.ok) {
      const admin = await resolvePlatformSession(result.token);
      expect(admin?.email).toBe(EMAIL);
    }
  });

  it('מחיקת דייר עם תיעוד עליו לא נחסמת — ה-cascade מנקה tenant_id בלבד', async () => {
    // 0013: הטריגר של append-only חסם גם את ה-UPDATE שה-FK
    // (`on delete set null`) מנפיק בעצמו כשדייר נמחק — כל מחיקת דייר
    // שיש עליו שורת תיעוד אחת נכשלה. זה בדיוק מה ש-`demo:reset` עושה.
    const { rows } = await withPlatform((tx) =>
      tx.query<{ id: string }>(
        `insert into tenants (slug, name) values ($1, 'דייר למחיקה') returning id`,
        [`del-${Date.now().toString(36)}`],
      ),
    );
    const tenantId = rows[0]!.id;
    await recordAudit({ kind: 'module_enabled', email: EMAIL, tenantId, detail: { module: 'documents' } });

    await withPlatform((tx) => tx.query('delete from tenants where id = $1', [tenantId]));

    const audit = await withPlatform((tx) =>
      tx.query<{ tenant_id: string | null; kind: string }>(
        "select tenant_id, kind from platform_audit where kind = 'module_enabled' and detail->>'module' = 'documents' order by at desc limit 1",
      ),
    );
    expect(audit.rows[0]?.tenant_id).toBeNull(); // ה-cascade עבד
    expect(audit.rows[0]?.kind).toBe('module_enabled'); // ושום דבר אחר בשורה לא זז

    // אבל שינוי אחר, לא-cascade, עדיין נדחה בשקט כרגיל.
    await expect(
      withPlatform((tx) => tx.query("update platform_audit set kind = 'tampered' where id = (select id from platform_audit limit 1)")),
    ).rejects.toThrow();
  });

  it('אותה התחברות גם מבטיחה את חבילות ברירת המחדל (0012)', async () => {
    await withPlatform((tx) => tx.query('delete from feature_packages'));

    const result = await signInPlatform({ email: EMAIL, password: PASSWORD, ip: '12.12.12.12' });
    expect(result.ok).toBe(true);

    const { rows } = await withPlatform((tx) =>
      tx.query<{ n: string }>('select count(*)::text as n from feature_packages'),
    );
    expect(Number(rows[0]?.n)).toBe(5);
  });
});
