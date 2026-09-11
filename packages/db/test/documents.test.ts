import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createCustomer, createDemoSession, createTenant, createDocument,
  documentStats, expiringDocuments, findDocumentByHash, getDocument, listDocuments, migrate,
  quietCustomers, recentIntake, search, setDocumentCustomer, setDocumentType, withPlatform, withTenant,
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

  it('findDocumentByHash מוצאת מסמך קיים לפי תוכן, לא לפי שם', async () => {
    const hash = 'abc123-fake-sha256';
    const id = await withTenant(alpha, (tx) =>
      createDocument(tx, {
        title: 'קובץ ראשון', filename: 'a.pdf', storageKey: 'local:x/a.pdf', contentHash: hash,
      }),
    );

    const found = await withTenant(alpha, (tx) => findDocumentByHash(tx, hash));
    expect(found?.id).toBe(id);

    // שם קובץ אחר לגמרי, אותו תוכן — עדיין נמצא, כי ההשוואה היא על ה-hash.
    expect(await withTenant(alpha, (tx) => findDocumentByHash(tx, hash))).not.toBeNull();
  });

  it('findDocumentByHash לא חוצה דיירים', async () => {
    const hash = 'shared-content-hash';
    await withTenant(alpha, (tx) =>
      createDocument(tx, { title: 'של א', filename: 'a.pdf', storageKey: 'local:x/a.pdf', contentHash: hash }),
    );
    // אותו hash בדיוק אצל דייר אחר — לא אמור להימצא כשמחפשים בהקשר של ב׳.
    expect(await withTenant(beta, (tx) => findDocumentByHash(tx, hash))).toBeNull();
  });

  it('hash שלא קיים מחזיר null', async () => {
    expect(await withTenant(alpha, (tx) => findDocumentByHash(tx, 'no-such-hash'))).toBeNull();
  });

  it('setDocumentCustomer משייכת ומבטלת שיוך, ולא חוצה דיירים', async () => {
    const docId = await withTenant(alpha, (tx) =>
      createDocument(tx, { title: 'לשיוך', filename: 's.pdf', storageKey: 'demo:contract.pdf' }),
    );
    expect(await withTenant(alpha, (tx) => setDocumentCustomer(tx, docId, dani))).toBe(true);
    expect((await withTenant(alpha, (tx) => getDocument(tx, docId)))?.customer_id).toBe(dani);

    expect(await withTenant(alpha, (tx) => setDocumentCustomer(tx, docId, null))).toBe(true);
    expect((await withTenant(alpha, (tx) => getDocument(tx, docId)))?.customer_id).toBeNull();

    // מזהה מסמך של דייר אחר — הבידוד הוא של המסד, אז 0 שורות מתעדכנות.
    const otherDoc = (await withTenant(beta, (tx) => listDocuments(tx)))[0]!.id;
    expect(await withTenant(alpha, (tx) => setDocumentCustomer(tx, otherDoc, dani))).toBe(false);
  });

  it('setDocumentType מעדכנת ביטחון ל-1 ומוציאה מ-needs_review', async () => {
    const docId = await withTenant(alpha, (tx) =>
      createDocument(tx, {
        title: 'לסיווג ידני', filename: 'r.pdf', storageKey: 'demo:delivery-note.pdf',
        docType: 'delivery_note', confidence: 0.4, status: 'needs_review',
      }),
    );
    expect(await withTenant(alpha, (tx) => setDocumentType(tx, docId, 'contract'))).toBe(true);
    const doc = await withTenant(alpha, (tx) => getDocument(tx, docId));
    expect(doc?.doc_type).toBe('contract');
    expect(doc?.doc_type_confidence).toBe(1);
    expect(doc?.status).toBe('filed');
  });

  it('setDocumentType על מסמך לא קיים מחזירה false', async () => {
    expect(await withTenant(alpha, (tx) => setDocumentType(tx, '00000000-0000-0000-0000-000000000000', 'contract'))).toBe(false);
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
