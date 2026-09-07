import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createCustomer, createDemoSession, createTenant, createDocument,
  documentStats, expiringDocuments, getDocument, listDocuments, migrate,
  quietCustomers, recentIntake, search, withPlatform, withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

describe.skipIf(!hasDb)('מסמכים', () => {
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
      const id = await createCustomer(tx, { displayName: 'דני כהן — סטודיו' });
      await createDocument(tx, { customerId: id, title: 'חוזה שירותים חתום', filename: 'c.pdf', storageKey: 'demo:contract.pdf', docType: 'contract', source: 'email' });
      await createDocument(tx, { customerId: id, title: 'אישור ניכוי מס במקור', filename: 't.pdf', storageKey: 'demo:tax-exemption.pdf', docType: 'tax_exemption', source: 'email', expiresOn: iso(12) });
      await createDocument(tx, { customerId: id, title: 'אישור קיום ביטוחים', filename: 'i.pdf', storageKey: 'demo:insurance.pdf', docType: 'insurance', source: 'scan', expiresOn: iso(200) });
      await createDocument(tx, { customerId: id, title: 'תעודת משלוח 4482', filename: 'd.pdf', storageKey: 'demo:delivery-note.pdf', docType: 'delivery_note', source: 'whatsapp', status: 'needs_review', confidence: 0.6 });
      return id;
    });

    await withTenant(beta, async (tx) => {
      const id = await createCustomer(tx, { displayName: 'לקוח של ב' });
      await createDocument(tx, { customerId: id, title: 'חוזה שירותים חתום', filename: 'x.pdf', storageKey: 'demo:contract.pdf', docType: 'contract' });
    });
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('רשימה מביאה גם את שם הלקוח', async () => {
    const docs = await withTenant(alpha, (tx) => listDocuments(tx));
    expect(docs).toHaveLength(4);
    expect(docs.every((d) => d.customer_name === 'דני כהן — סטודיו')).toBe(true);
  });

  it('מסמך של דייר אחר אינו נגיש גם עם המזהה', async () => {
    const other = await withTenant(beta, (tx) => listDocuments(tx));
    expect(await withTenant(alpha, (tx) => getDocument(tx, other[0]!.id))).toBeNull();
  });

  it('סינון לפי סוג וערוץ', async () => {
    expect(await withTenant(alpha, (tx) => listDocuments(tx, { docType: 'contract' }))).toHaveLength(1);
    expect(await withTenant(alpha, (tx) => listDocuments(tx, { source: 'whatsapp' }))).toHaveLength(1);
  });

  it('תפוגה קרובה בלבד', async () => {
    const soon = await withTenant(alpha, (tx) => expiringDocuments(tx, 60));
    expect(soon.map((d) => d.title)).toEqual(['אישור ניכוי מס במקור']);
  });

  it('קליטה אחרונה אינה כוללת העלאות ידניות', async () => {
    await withTenant(alpha, (tx) =>
      createDocument(tx, { customerId: dani, title: 'הועלה ביד', filename: 'u.pdf', storageKey: 'demo:quote.pdf', source: 'upload' }),
    );
    const intake = await withTenant(alpha, (tx) => recentIntake(tx));
    expect(intake.map((d) => d.title)).not.toContain('הועלה ביד');
  });

  it('מדדים סופרים רק את הדייר עצמו', async () => {
    const stats = await withTenant(alpha, (tx) => documentStats(tx));
    expect(stats.total).toBe(5);
    expect(stats.needs_review).toBe(1);
    expect(stats.expiring_soon).toBe(1);
  });

  it('חיפוש מוצא מסמכים ולקוחות ואינו חוצה דיירים', async () => {
    const hits = await withTenant(alpha, (tx) => search(tx, 'חוזה'));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.kind).toBe('document');

    const byCustomer = await withTenant(alpha, (tx) => search(tx, 'דני'));
    expect(byCustomer.some((h) => h.kind === 'customer')).toBe(true);
  });

  it('חיפוש ריק אינו מחזיר הכל', async () => {
    expect(await withTenant(alpha, (tx) => search(tx, '   '))).toEqual([]);
  });

  it('לקוח בלי אירועים נחשב נשכח', async () => {
    const quiet = await withTenant(alpha, (tx) => quietCustomers(tx, 60));
    expect(quiet.map((c) => c.display_name)).toContain('דני כהן — סטודיו');
  });
});

describe.skipIf(!hasDb)('כניסת דמו', () => {
  afterAll(async () => { await closePool(); });

  it('מסרבת לדייר שאינו מסומן כדמו, גם כשהוא ברשימה המותרת', async () => {
    const stamp = Date.now().toString(36);
    const real = `real-${stamp}`;
    await createTenant({ slug: real, name: 'דייר אמיתי', modules: ['documents'] });
    process.env['DEMO_TENANT_SLUGS'] = real;
    expect(await createDemoSession(real)).toBeNull();
  });

  it('מסרבת לדייר שאינו ברשימה המותרת', async () => {
    process.env['DEMO_TENANT_SLUGS'] = 'demo-something';
    expect(await createDemoSession('another')).toBeNull();
  });

  it('כבויה לגמרי כשאין רשימה', async () => {
    delete process.env['DEMO_TENANT_SLUGS'];
    expect(await createDemoSession('anything')).toBeNull();
  });
});
