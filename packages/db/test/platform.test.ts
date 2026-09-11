import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createTenant, listTenants, migrate, publishEvent, withPlatform, withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDb)('listTenants — מטא-דאטה חוצת-דיירים', () => {
  let active: string;
  let quiet: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
    const stamp = Date.now().toString(36);
    active = await createTenant({ slug: `active-${stamp}`, name: 'עסק פעיל', modules: [] });
    quiet = await createTenant({ slug: `quiet-${stamp}`, name: 'עסק שקט', modules: [] });

    // דייר פעיל: כמה כניסות וכמה פעולות-אנוש בחלון ה-14 יום.
    await withTenant(active, async (tx) => {
      for (let i = 0; i < 3; i++) {
        await publishEvent(tx, { type: 'kernel.user_signed_in', actorType: 'user' });
      }
      await publishEvent(tx, { type: 'kernel.customer_created', actorType: 'user', payload: {} });
      await publishEvent(tx, { type: 'leads.created', actorType: 'user', payload: {} });
      // אירוע מערכת — לא אמור להיספר כפעולת אנוש.
      await publishEvent(tx, { type: 'documents.expiring', actorType: 'system', payload: {} });
    });

    // דייר שקט: שום אירוע בכלל — לא נכתב אליו כלום בכוונה.
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('סופרת כניסות ופעולות-אנוש בנפרד, ולא כוללת אירועי מערכת', async () => {
    const tenants = await listTenants();
    const a = tenants.find((t) => t.id === active);
    expect(a?.logins_14d).toBe(3);
    expect(a?.actions_14d).toBe(2);
  });

  it('דייר בלי כניסות/פעולות-אנוש מקבל אפסים, לא שגיאה — גם ש-last_activity_at לא ריק', async () => {
    // כל דייר נולד עם kernel.tenant_created (מערכת) — last_activity_at
    // לעולם לא ריק באמת, אבל זה אירוע מערכת ולא אמור להיספר כאן.
    const tenants = await listTenants();
    const q = tenants.find((t) => t.id === quiet);
    expect(q?.logins_14d).toBe(0);
    expect(q?.actions_14d).toBe(0);
    expect(q?.last_activity_at).not.toBeNull();
  });

  it('לא סופרת אירוע כניסה גם בתור פעולת-אנוש (אין ספירה כפולה)', async () => {
    const tenants = await listTenants();
    const a = tenants.find((t) => t.id === active);
    // 3 כניסות + 2 פעולות + 1 אירוע מערכת = 6 אירועים בסך הכול,
    // אבל logins+actions חייב להישאר 3+2=5, לא 6 ולא 8.
    expect((a?.logins_14d ?? 0) + (a?.actions_14d ?? 0)).toBe(5);
  });
});
