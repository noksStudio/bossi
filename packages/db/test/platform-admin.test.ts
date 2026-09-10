import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  adminCredentials, closePool, hashPassword, migrate, recordAudit,
  resolvePlatformSession, signInPlatform, signOutPlatform, verifyPassword, withPlatform,
} from '../src/index';

/**
 * הריאלם השלישי. הבדיקות כאן שואלות דבר אחד: **האם הדלת נסגרת.**
 */

const hasDb = Boolean(process.env['DATABASE_URL']);
const PASSWORD = 'correct-horse-battery-staple';
const EMAIL = 'admin@bossi.test';

describe('גיבוב סיסמה', () => {
  it('אותה סיסמה מייצרת hash שונה בכל פעם', async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).not.toBe(b);          // מלח אקראי
    expect(await verifyPassword(PASSWORD, a)).toBe(true);
    expect(await verifyPassword(PASSWORD, b)).toBe(true);
  });

  it('סיסמה שגויה נדחית', async () => {
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword('correct-horse-battery-stapl', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('hash פגום נדחה ולא זורק', async () => {
    for (const bad of ['', 'nonsense', 'scrypt$only-two', 'bcrypt$a$b', 'scrypt$$', 'scrypt$YQ$YQ']) {
      expect(await verifyPassword(PASSWORD, bad), bad).toBe(false);
    }
  });

  it('נורמליזציית יוניקוד — אותה סיסמה בעברית עוברת בשתי הצורות', async () => {
    const stored = await hashPassword('סיסמה־חזקה־מאוד');
    expect(await verifyPassword('סיסמה־חזקה־מאוד'.normalize('NFD'), stored)).toBe(true);
  });
});

describe('הקונסולה כבויה כברירת מחדל', () => {
  it('בלי משתני סביבה אין אדמין בכלל', () => {
    delete process.env['PLATFORM_ADMIN_EMAIL'];
    delete process.env['PLATFORM_ADMIN_PASSWORD_HASH'];
    expect(adminCredentials()).toBeNull();
  });

  it('משתנה אחד בלבד אינו מספיק', () => {
    process.env['PLATFORM_ADMIN_EMAIL'] = EMAIL;
    delete process.env['PLATFORM_ADMIN_PASSWORD_HASH'];
    expect(adminCredentials()).toBeNull();

    delete process.env['PLATFORM_ADMIN_EMAIL'];
    process.env['PLATFORM_ADMIN_PASSWORD_HASH'] = 'scrypt$a$b';
    expect(adminCredentials()).toBeNull();
  });
});

describe.skipIf(!hasDb)('התחברות אדמין', () => {
  beforeAll(async () => {
    await migrate(() => {});
    process.env['PLATFORM_ADMIN_EMAIL'] = EMAIL;
    process.env['PLATFORM_ADMIN_PASSWORD_HASH'] = await hashPassword(PASSWORD);
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
    delete process.env['PLATFORM_ADMIN_PASSWORD_HASH'];
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

    const saved = process.env['PLATFORM_ADMIN_PASSWORD_HASH'];
    delete process.env['PLATFORM_ADMIN_PASSWORD_HASH'];
    expect(await resolvePlatformSession(result.token)).toBeNull();
    process.env['PLATFORM_ADMIN_PASSWORD_HASH'] = saved;
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
});
