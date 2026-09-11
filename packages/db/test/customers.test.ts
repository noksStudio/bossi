import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool,
  createContact,
  createCustomer,
  createTenant,
  customerTimeline,
  deleteContact,
  getCustomerDetail,
  listCustomers,
  matchCustomers,
  migrate,
  publishEvent,
  quickSearchCustomers,
  updateCustomer,
  withPlatform,
  withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDb)('לקוחות וציר הזמן', () => {
  let alpha: string;
  let beta: string;
  let dani: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});

    const stamp = Date.now().toString(36);
    alpha = await createTenant({ slug: `a-${stamp}`, name: 'דייר א', modules: ['documents'] });
    beta = await createTenant({ slug: `b-${stamp}`, name: 'דייר ב', modules: ['documents'] });

    dani = await withTenant(alpha, async (tx) => {
      const id = await createCustomer(tx, {
        displayName: 'דני כהן — סטודיו',
        legalName: 'ד. כהן עיצוב בע״מ',
        businessId: '515993027',
        tags: ['ריטיינר'],
      });
      await createContact(tx, { customerId: id, name: 'דני כהן', roles: ['approves', 'pays'], isPrimary: true });
      await createContact(tx, { customerId: id, name: 'שירה אלון', roles: ['orders'] });
      await publishEvent(tx, { type: 'kernel.customer_created', customerId: id, payload: { name: 'דני' } });
      return id;
    });

    await withTenant(alpha, (tx) => createCustomer(tx, { displayName: 'נורית ברק', status: 'prospect' }));
    await withTenant(beta, (tx) => createCustomer(tx, { displayName: 'דני כהן — של דייר אחר' }));
  }, 30_000);

  afterAll(async () => {
    await closePool();
  });

  it('כרטיס הלקוח מביא אנשי קשר וספירת אירועים במכה אחת', async () => {
    const detail = await withTenant(alpha, (tx) => getCustomerDetail(tx, dani));
    expect(detail).not.toBeNull();
    expect(detail!.display_name).toBe('דני כהן — סטודיו');
    expect(detail!.contacts).toHaveLength(2);
    expect(detail!.event_count).toBe(1);
    // איש הקשר הראשי ראשון
    expect(detail!.contacts[0]!.is_primary).toBe(true);
  });

  it('אנשי הקשר נושאים תפקידים — מזמין ומשלם אינם אותו אדם', async () => {
    const detail = await withTenant(alpha, (tx) => getCustomerDetail(tx, dani));
    const roles = Object.fromEntries(detail!.contacts.map((c) => [c.name, c.roles]));
    expect(roles['דני כהן']).toEqual(['approves', 'pays']);
    expect(roles['שירה אלון']).toEqual(['orders']);
  });

  it('כרטיס של דייר אחר לא נגיש גם עם המזהה המדויק', async () => {
    const other = await withTenant(beta, (tx) => listCustomers(tx));
    expect(await withTenant(alpha, (tx) => getCustomerDetail(tx, other[0]!.id))).toBeNull();
  });

  it('עדכון חלקי לא מוחק שדות שלא נשלחו', async () => {
    await withTenant(alpha, (tx) => updateCustomer(tx, dani, { paymentTermsDays: 45 }));
    const detail = await withTenant(alpha, (tx) => getCustomerDetail(tx, dani));
    expect(detail!.payment_terms_days).toBe(45);
    expect(detail!.legal_name).toBe('ד. כהן עיצוב בע״מ');
    expect(detail!.business_id).toBe('515993027');
  });

  it('עדכון לקוח של דייר אחר לא נוגע בו', async () => {
    const other = await withTenant(beta, (tx) => listCustomers(tx));
    expect(await withTenant(alpha, (tx) => updateCustomer(tx, other[0]!.id, { displayName: 'נחטף' }))).toBe(false);
  });

  it('חיפוש מהיר מדרג התאמת תחילית ראשונה', async () => {
    const results = await withTenant(alpha, (tx) => quickSearchCustomers(tx, 'דני'));
    expect(results[0]!.display_name).toBe('דני כהן — סטודיו');
    // הלקוח של הדייר השני נושא שם דומה ואינו מופיע
    expect(results).toHaveLength(1);
  });

  it('חיפוש מהיר מוצא גם לפי ח״פ', async () => {
    const results = await withTenant(alpha, (tx) => quickSearchCustomers(tx, '515993'));
    expect(results.map((r) => r.id)).toContain(dani);
  });

  it('חיפוש ריק מחזיר לקוחות פעילים אחרונים', async () => {
    const results = await withTenant(alpha, (tx) => quickSearchCustomers(tx, '  '));
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === 'active')).toBe(true);
  });

  it('ציר הזמן מסודר מהחדש לישן', async () => {
    await withTenant(alpha, (tx) =>
      publishEvent(tx, { type: 'kernel.customer_updated', customerId: dani, payload: { field: 'terms' } }),
    );
    const events = await withTenant(alpha, (tx) => customerTimeline(tx, dani));
    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('kernel.customer_updated');
  });

  it('ציר הזמן מסונן לפי סוג', async () => {
    const events = await withTenant(alpha, (tx) =>
      customerTimeline(tx, dani, { types: ['kernel.customer_created'] }),
    );
    expect(events).toHaveLength(1);
  });

  it('מחיקת איש קשר לא נוגעת באיש קשר של דייר אחר', async () => {
    const otherCustomer = await withTenant(beta, (tx) => listCustomers(tx));
    const otherContact = await withTenant(beta, (tx) =>
      createContact(tx, { customerId: otherCustomer[0]!.id, name: 'איש של ב' }),
    );
    expect(await withTenant(alpha, (tx) => deleteContact(tx, otherContact))).toBe(false);
    expect(await withTenant(beta, (tx) => deleteContact(tx, otherContact))).toBe(true);
  });

  it('סינון לפי סטטוס', async () => {
    const prospects = await withTenant(alpha, (tx) => listCustomers(tx, { status: 'prospect' }));
    expect(prospects.map((c) => c.display_name)).toEqual(['נורית ברק']);
  });

  it('matchCustomers: ח.פ מדויק מתאים בביטחון גבוה, גם עם עיצוב שונה', async () => {
    const [result] = await withTenant(alpha, (tx) =>
      matchCustomers(tx, { businessIds: ['515-993-027'] }),
    );
    expect(result?.customerId).toBe(dani);
    expect(result?.matchedBy).toEqual(['business_id']);
    expect(result?.confidence).toBeGreaterThan(0.9);
  });

  it('matchCustomers: שם משפטי (legal_name) נמצא גם כששם התצוגה שונה לגמרי', async () => {
    // "ד. כהן עיצוב בע״מ" הוא ה-legal_name; שם התצוגה "דני כהן — סטודיו"
    // שונה לגמרי — בלי חיפוש גם מול legal_name ההתאמה הזו הייתה נכשלת.
    const results = await withTenant(alpha, (tx) => matchCustomers(tx, { names: ['ד. כהן עיצוב בע״מ'] }));
    expect(results.some((r) => r.customerId === dani && r.matchedBy.includes('name'))).toBe(true);
  });

  it('matchCustomers: התאמה כפולה (ח.פ + שם) מקבלת ביטחון גבוה יותר משל כל אות לבד', async () => {
    const both = await withTenant(alpha, (tx) =>
      matchCustomers(tx, { businessIds: ['515993027'], names: ['ד. כהן עיצוב בע״מ'] }),
    );
    const idOnly = await withTenant(alpha, (tx) => matchCustomers(tx, { businessIds: ['515993027'] }));
    const match = both.find((r) => r.customerId === dani);
    expect(match?.matchedBy.sort()).toEqual(['business_id', 'name']);
    expect(match!.confidence).toBeGreaterThan(idOnly[0]!.confidence);
  });

  it('matchCustomers: שם רחוק מדי (מתחת לסף הדמיון) לא מוחזר', async () => {
    const results = await withTenant(alpha, (tx) => matchCustomers(tx, { names: ['חברה שלא קיימת בכלל'] }));
    expect(results).toEqual([]);
  });

  it('matchCustomers: לא חוצה דיירים — ח.פ ושם דומים בדייר אחר לא מתאימים', async () => {
    const results = await withTenant(beta, (tx) =>
      matchCustomers(tx, { businessIds: ['515993027'], names: ['ד. כהן עיצוב בע״מ'] }),
    );
    expect(results.every((r) => r.customerId !== dani)).toBe(true);
  });

  it('matchCustomers: בלי מועמדים בכלל מחזירה רשימה ריקה', async () => {
    expect(await withTenant(alpha, (tx) => matchCustomers(tx, {}))).toEqual([]);
  });
});
