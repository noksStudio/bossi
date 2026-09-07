import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createCheck, createCustomer, createNote, createTenant, createUser,
  deleteNote, listNotes, markCheck, migrate, togglePin, updateNote,
  withPlatform, withPrincipal, withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);

/**
 * הכלל שראובן ביקש: עובדים כותבים, רק הבעלים מוחק.
 * הבדיקות כאן מנסות לעקוף אותו ישירות מול המסד — בלי לעבור דרך הממשק.
 */
describe.skipIf(!hasDb)('הערות והרשאות', () => {
  let tenant: string;
  let otherTenant: string;
  let owner: string;
  let staff: string;
  let customer: string;

  const asOwner = <T,>(fn: Parameters<typeof withPrincipal<T>>[1]) =>
    withPrincipal({ tenantId: tenant, userId: owner, role: 'owner' }, fn);
  const asStaff = <T,>(fn: Parameters<typeof withPrincipal<T>>[1]) =>
    withPrincipal({ tenantId: tenant, userId: staff, role: 'staff' }, fn);

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
    const stamp = Date.now().toString(36);
    tenant = await createTenant({ slug: `t-${stamp}`, name: 'דייר', modules: ['documents'] });
    otherTenant = await createTenant({ slug: `o-${stamp}`, name: 'אחר', modules: ['documents'] });

    const ids = await withTenant(tenant, async (tx) => ({
      owner: await createUser(tx, { email: 'owner@x.co.il', name: 'ראובן', role: 'owner' }),
      staff: await createUser(tx, { email: 'staff@x.co.il', name: 'סיגל', role: 'staff' }),
      customer: await createCustomer(tx, { displayName: 'שוכר' }),
    }));
    owner = ids.owner; staff = ids.staff; customer = ids.customer;
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('עובד יכול לכתוב רישום', async () => {
    const id = await asStaff((tx) => createNote(tx, { body: 'הועבר 2,000 במקום 2,200 במאי', customerId: customer }));
    expect(id).toBeTruthy();
    const notes = await asStaff((tx) => listNotes(tx, { customerId: customer }));
    expect(notes[0]!.author_name).toBe('סיגל');
  });

  it('עובד לא יכול למחוק — גם בקריאה ישירה למסד', async () => {
    const id = await asStaff((tx) => createNote(tx, { body: 'לא למחוק', customerId: customer }));
    // deleteNote מריץ DELETE רגיל. המדיניות במסד היא שעוצרת.
    expect(await asStaff((tx) => deleteNote(tx, id))).toBe(false);
    const still = await asStaff((tx) => listNotes(tx, { customerId: customer }));
    expect(still.some((n) => n.id === id)).toBe(true);
  });

  it('הבעלים מוחק', async () => {
    const id = await asStaff((tx) => createNote(tx, { body: 'זמני', customerId: customer }));
    expect(await asOwner((tx) => deleteNote(tx, id))).toBe(true);
  });

  it('עובד לא משכתב רישום של אחר', async () => {
    const byOwner = await asOwner((tx) => createNote(tx, { body: 'של הבעלים', customerId: customer }));
    expect(await asStaff((tx) => updateNote(tx, byOwner, 'שונה'))).toBe(false);
  });

  it('עובד כן עורך את הרישום של עצמו', async () => {
    const mine = await asStaff((tx) => createNote(tx, { body: 'שלי', customerId: customer }));
    expect(await asStaff((tx) => updateNote(tx, mine, 'שלי, מתוקן'))).toBe(true);
  });

  it('הצמדה מותרת לכותב', async () => {
    const mine = await asStaff((tx) => createNote(tx, { body: 'להצמיד', customerId: customer }));
    expect(await asStaff((tx) => togglePin(tx, mine, true))).toBe(true);
  });

  it('הקשר בלי משתמש נכשל סגור — עבודת רקע לא מוחקת רישומים', async () => {
    const id = await asOwner((tx) => createNote(tx, { body: 'רקע', customerId: customer }));
    expect(await withTenant(tenant, (tx) => deleteNote(tx, id))).toBe(false);
  });

  it('רישום אינו נראה לדייר אחר', async () => {
    await asOwner((tx) => createNote(tx, { body: 'סודי', customerId: customer }));
    const seen = await withTenant(otherTenant, (tx) => listNotes(tx));
    expect(seen).toEqual([]);
  });

  it('רישום ריק נדחה', async () => {
    await expect(asOwner((tx) => createNote(tx, { body: '   ', customerId: customer }))).rejects.toThrow();
  });
});

describe.skipIf(!hasDb)('סימון צ׳קים', () => {
  let tenant: string;
  let owner: string;
  let customer: string;
  let checkId: string;

  const asOwner = <T,>(fn: Parameters<typeof withPrincipal<T>>[1]) =>
    withPrincipal({ tenantId: tenant, userId: owner, role: 'owner' }, fn);

  beforeAll(async () => {
    const stamp = Date.now().toString(36);
    tenant = await createTenant({ slug: `c-${stamp}`, name: 'צ׳קים', modules: ['documents'] });
    const ids = await withTenant(tenant, async (tx) => ({
      owner: await createUser(tx, { email: `o-${stamp}@x.co.il`, name: 'ראובן', role: 'owner' }),
      customer: await createCustomer(tx, { displayName: 'שוכר' }),
    }));
    owner = ids.owner; customer = ids.customer;
    checkId = await asOwner((tx) => createCheck(tx, { customerId: customer, amount: '2200.00', dueOn: '2026-09-01' }));
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('סימון נפרע רושם מי בדק ומתי — זו הראיה שמישהו באמת פתח את דף הבנק', async () => {
    expect(await asOwner((tx) => markCheck(tx, checkId, { status: 'cleared' }))).toBe(true);
    const { rows } = await asOwner((tx) =>
      tx.query<{ status: string; cleared_by: string; cleared_amount: string }>(
        'select status, cleared_by, cleared_amount::text from checks where id = $1', [checkId]),
    );
    expect(rows[0]!.status).toBe('cleared');
    expect(rows[0]!.cleared_by).toBe(owner);
    // פירעון מלא ממלא את הסכום מהצ'ק עצמו
    expect(rows[0]!.cleared_amount).toBe('2200.00');
  });

  it('ביטול סימון מנקה את החתימה — לא נשארת ראיה לבדיקה שלא נעשתה', async () => {
    await asOwner((tx) => markCheck(tx, checkId, { status: 'pending' }));
    const { rows } = await asOwner((tx) =>
      tx.query<{ cleared_by: string | null; cleared_at: Date | null }>(
        'select cleared_by, cleared_at from checks where id = $1', [checkId]),
    );
    expect(rows[0]!.cleared_by).toBeNull();
    expect(rows[0]!.cleared_at).toBeNull();
  });

  it('פירעון חלקי חייב סכום נמוך מהצ׳ק — המסד לא מרשה סתירה', async () => {
    await expect(
      asOwner((tx) => markCheck(tx, checkId, { status: 'partial', clearedAmount: '2500.00' })),
    ).rejects.toThrow();
  });

  it('פירעון חלקי תקין נשמר', async () => {
    expect(await asOwner((tx) => markCheck(tx, checkId, { status: 'partial', clearedAmount: '2000.00' }))).toBe(true);
  });
});
