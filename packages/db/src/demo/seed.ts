import { PRESETS, type ModuleId } from '@bossi/kernel';
import { createTenant, withPlatform, withPrincipal, withTenant, type Tx } from '../client';
import { createContact, createCustomer, createUser, updateCustomer } from '../repositories';
import { createDocument } from '../documents';
import { publishEvent } from '../events';
import {
  seedBilling, seedCommerce, seedPortalUsers, seedRetainers, type SeedCustomer,
} from './business';
import {
  COMMERCE_CUSTOMERS,
  CORRESPONDENCE_SUBJECTS,
  DOC_TEMPLATES,
  SERVICES_CUSTOMERS,
  type DemoCustomer,
} from './data';

/**
 * זריעת דמו.
 *
 * דטרמיניסטית לחלוטין: אותו זרע → אותם לקוחות, אותם מסמכים, אותם
 * תאריכים. דמו שאפשר לחזור עליו הוא דמו שאפשר לתרגל.
 *
 * התאריכים יחסיים ל"עכשיו", כדי שהתוקפים תמיד יפוגו בשבועות הקרובים
 * ולא ב-2024 — אחרת מסך "דורש תשומת לב" נראה ריק בכל הדגמה שנייה.
 */

/** mulberry32 — קטן, מהיר, ומספיק אקראי לנתוני הדגמה. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const SOURCE_MIX = ['email', 'email', 'email', 'email', 'whatsapp', 'whatsapp', 'scan', 'scan', 'upload'];

/** מסמכי ה-PDF שנוצרו מראש. מיפוי לפי סוג — לחיצה פותחת מסמך שנראה נכון. */
const DEMO_PDF: Record<string, string> = {
  contract: 'demo:contract.pdf',
  quote: 'demo:quote.pdf',
  invoice: 'demo:invoice.pdf',
  receipt: 'demo:receipt.pdf',
  delivery_note: 'demo:delivery-note.pdf',
  tax_exemption: 'demo:tax-exemption.pdf',
  insurance: 'demo:insurance.pdf',
  bank_guarantee: 'demo:bank-guarantee.pdf',
  meeting_notes: 'demo:meeting-notes.pdf',
  correspondence: 'demo:correspondence.pdf',
};

const WEIGHTED_TYPES = Object.entries(DOC_TEMPLATES).flatMap(([type, t]) =>
  Array.from({ length: t.weight }, () => type),
);

interface SeedResult {
  tenantId: string;
  customers: number;
  documents: number;
  events: number;
}

async function seedTenant(
  opts: {
    slug: string;
    name: string;
    businessId: string;
    plan: 'pro' | 'mega';
    modules: readonly ModuleId[];
    ownerEmail: string;
    ownerName: string;
    staff: Array<{ email: string; name: string; role: string }>;
    customers: DemoCustomer[];
    invoicePrefix: string;
    invoiceBase: number;
    invoiceSubjects: string[];
    seed: number;
  },
  log: (m: string) => void,
): Promise<SeedResult> {
  const random = rng(opts.seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

  const tenantId = await createTenant({
    slug: opts.slug,
    name: opts.name,
    plan: opts.plan,
    modules: opts.modules,
    businessId: opts.businessId,
  });
  await withPlatform((tx) => tx.query('update tenants set is_demo = true where id = $1', [tenantId]));

  let documents = 0;
  let events = 0;
  let docNumber = 1000 + between(100, 400);

  let ownerId = '';
  const staffIds: string[] = [];

  await withTenant(tenantId, async (tx) => {
    ownerId = await createUser(tx, { email: opts.ownerEmail, name: opts.ownerName, role: 'owner' });
    for (const s of opts.staff) staffIds.push(await createUser(tx, s));

    for (const c of opts.customers) {
      // לקוח ותיק נפתח מזמן; ליד נפתח לאחרונה.
      const ageDays = c.status === 'prospect' ? between(10, 60) : between(200, 620);
      const createdAt = new Date(Date.now() - ageDays * DAY);

      const customerId = await createCustomer(tx, {
        displayName: c.name,
        legalName: c.legal ?? null,
        businessId: c.businessId ?? null,
        status: c.status ?? 'active',
        paymentTermsDays: c.terms,
        creditLimit: c.creditLimit ?? null,
        tags: c.tags,
      });
      if (c.notes) await updateCustomer(tx, customerId, { notes: c.notes });
      await withCreatedAt(tx, 'customers', customerId, createdAt);

      await publishEvent(tx, {
        type: 'kernel.customer_created',
        actorType: 'user',
        customerId,
        occurredAt: createdAt,
        payload: { name: c.name },
      });
      events++;

      for (const contact of c.contacts) {
        await createContact(tx, {
          customerId,
          name: contact.name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          roles: contact.roles,
          isPrimary: contact.primary ?? false,
        });
        await publishEvent(tx, {
          type: 'kernel.contact_added',
          actorType: 'user',
          customerId,
          occurredAt: new Date(createdAt.getTime() + between(1, 5) * DAY),
          payload: { name: contact.name, role: contact.roles.join(', ') },
        });
        events++;
      }

      // מסמכים פרוסים על כל חיי הלקוח, עם עצירה לפני "היום" אצל
      // הלקוחות השקטים כדי שהם באמת ייראו נטושים.
      const quietCutoff = c.quietDays ? Date.now() - c.quietDays * DAY : Date.now();
      const count = Math.max(2, Math.round(c.weight * between(15, 25) / 10));

      for (let i = 0; i < count; i++) {
        const type = pick(WEIGHTED_TYPES);
        const template = DOC_TEMPLATES[type]!;
        const span = quietCutoff - createdAt.getTime();
        if (span <= 0) continue;
        const when = new Date(createdAt.getTime() + random() * span);

        let title = pick(template.titles);
        if (title.includes('#')) title = title.replace('#', String(docNumber++));
        if (type === 'correspondence') title += pick(CORRESPONDENCE_SUBJECTS);

        // ביטוח ואישור ניכוי מס מתחדשים שנתית — התוקף נמדד מהאחרון
        // שהונפק, ולכן חלקם פגים בדיוק בשבועות הקרובים.
        const expires =
          template.expiryMonths !== undefined
            ? new Date(when.getTime() + template.expiryMonths * 30.4 * DAY)
            : null;

        const lowConfidence = random() < 0.05;
        const source = pick(SOURCE_MIX);

        const documentId = await createDocument(tx, {
          customerId,
          title,
          filename: filenameFor(type, source, docNumber),
          storageKey: DEMO_PDF[type] ?? 'demo:correspondence.pdf',
          docType: type,
          confidence: lowConfidence ? 0.55 + random() * 0.2 : 0.9 + random() * 0.09,
          source,
          status: lowConfidence ? 'needs_review' : 'filed',
          issuedOn: when.toISOString().slice(0, 10),
          expiresOn: expires ? expires.toISOString().slice(0, 10) : null,
          amount: template.hasAmount ? String(between(1200, 48000) + between(0, 99) / 100) : null,
          byteSize: between(45_000, 2_400_000),
          createdAt: when,
        });
        documents++;

        await publishEvent(tx, {
          type: 'documents.received',
          actorType: 'system',
          customerId,
          subjectType: 'document',
          subjectId: documentId,
          occurredAt: when,
          payload: { title },
        });
        await publishEvent(tx, {
          type: lowConfidence ? 'documents.needs_review' : 'documents.filed',
          actorType: 'system',
          customerId,
          subjectType: 'document',
          subjectId: documentId,
          occurredAt: new Date(when.getTime() + between(1, 90) * 1000),
          payload: { title },
        });
        events += 2;
      }
    }
  });

  // ── שכבת ההדגמה ────────────────────────────────────────────────────────
  //
  // הפיזור האקראי לבדו משאיר את "דורש תשומת לב" ריק: תוקף של שנה שנספר
  // מתאריך הנפקה אקראי נוחת כמעט תמיד בעבר או רחוק בעתיד. בעסק אמיתי
  // אישורי ניכוי וביטוחים מתחדשים שנתית, ולכן תמיד יש כמה שפגים החודש —
  // וזה מה שהשכבה הזו מייצרת במפורש, יחד עם קליטה טרייה.
  const highlights = await seedHighlights(tenantId, opts.customers, random);
  documents += highlights.documents;
  events += highlights.events;

  // ── הכסף והמסחר ────────────────────────────────────────────────────────
  //
  // רץ תחת `withPrincipal` ולא `withTenant`: תקבול, הבטחת תשלום ואישור
  // הזמנה נושאים "מי עשה את זה", וההקשר הוא מה שמספק את התשובה. seed
  // שכותב אותם בלי זהות מייצר בדיוק את החורים שהמסך אמור למלא.
  const principal = { tenantId, userId: ownerId, role: 'owner' };
  const extra = await withPrincipal(principal, async (tx) => {
    const { rows } = await tx.query<{ id: string; display_name: string; payment_terms_days: number; tags: string[] }>(
      `select id, display_name, payment_terms_days, tags from customers
        where status <> 'prospect' order by created_at`,
    );
    const seedCustomers: SeedCustomer[] = rows.map((r) => ({
      id: r.id, name: r.display_name, terms: r.payment_terms_days, tags: r.tags,
    }));

    const money = await seedBilling(tx, seedCustomers, {
      prefix: opts.invoicePrefix,
      base: opts.invoiceBase,
      random,
      subjects: opts.invoiceSubjects,
    });

    const retainers = opts.modules.includes('retainers')
      ? await seedRetainers(tx, seedCustomers, { random, userIds: [ownerId, ...staffIds] })
      : 0;

    const commerce = opts.modules.includes('catalog')
      ? await seedCommerce(tx, seedCustomers, { random })
      : { products: 0, orders: 0 };

    const portalUsers = opts.modules.includes('portal')
      ? await seedPortalUsers(tx, seedCustomers, {
          random,
          permissions: opts.modules.includes('orders')
            ? ['documents.read', 'invoices.read', 'orders.read', 'orders.place']
            : ['documents.read', 'invoices.read'],
        })
      : 0;

    return { ...money, retainers, ...commerce, portalUsers };
  });

  log(
    `  ✓ ${opts.name}: ${opts.customers.length} לקוחות · ${documents} מסמכים · ` +
      `${extra.invoices} חשבוניות · ${describeExtras(extra)}${events} אירועים`,
  );
  return { tenantId, customers: opts.customers.length, documents, events };
}

function describeExtras(e: { retainers: number; products: number; orders: number; portalUsers: number }): string {
  const parts: string[] = [];
  if (e.retainers) parts.push(`${e.retainers} ריטיינרים`);
  if (e.products) parts.push(`${e.products} מוצרים`);
  if (e.orders) parts.push(`${e.orders} הזמנות`);
  if (e.portalUsers) parts.push(`${e.portalUsers} משתמשי פורטל`);
  return parts.length ? `${parts.join(' · ')} · ` : '';
}

/** מסמכים חיים שפגים בשבועות הקרובים, וקליטה של הימים האחרונים. */
async function seedHighlights(
  tenantId: string,
  customers: DemoCustomer[],
  random: () => number,
): Promise<{ documents: number; events: number }> {
  const active = customers.filter((c) => (c.status ?? 'active') === 'active' && !c.quietDays);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;

  const expiring = [
    { days: 6, type: 'tax_exemption', title: 'אישור ניכוי מס במקור 2026' },
    { days: 13, type: 'insurance', title: 'אישור קיום ביטוחים' },
    { days: 21, type: 'tax_exemption', title: 'אישור ניהול ספרים' },
    { days: 34, type: 'bank_guarantee', title: 'ערבות בנקאית לביצוע' },
    { days: 48, type: 'insurance', title: 'אישור קיום ביטוחים — צד ג׳' },
  ];

  const arriving = [
    { hoursAgo: 3, type: 'invoice', source: 'email', title: 'חשבונית ספק — חשמל תעשייתי' },
    { hoursAgo: 5, type: 'quote', source: 'whatsapp', title: 'הצעת מחיר חתומה' },
    { hoursAgo: 9, type: 'delivery_note', source: 'scan', title: 'תעודת משלוח 4482' },
    { hoursAgo: 20, type: 'tax_exemption', source: 'email', title: 'אישור ניכוי מס 2026' },
    { hoursAgo: 26, type: 'meeting_notes', source: 'whatsapp', title: 'סיכום פגישת סטטוס' },
    { hoursAgo: 31, type: 'contract', source: 'email', title: 'נספח להסכם — הרחבת היקף' },
    { hoursAgo: 44, type: 'invoice', source: 'email', title: 'חשבונית מס 2291' },
    { hoursAgo: 52, type: 'delivery_note', source: 'scan', title: 'תעודת משלוח חתומה 4479' },
  ];

  let documents = 0;
  let events = 0;

  await withTenant(tenantId, async (tx) => {
    const { rows } = await tx.query<{ id: string; display_name: string }>(
      'select id, display_name from customers where status = $1',
      ['active'],
    );
    const byName = new Map(rows.map((r) => [r.display_name, r.id]));
    const idFor = (c: DemoCustomer) => byName.get(c.name)!;

    for (const [i, e] of expiring.entries()) {
      const customer = active[i % active.length]!;
      const when = new Date(Date.now() - (365 - e.days) * DAY);
      const documentId = await createDocument(tx, {
        customerId: idFor(customer),
        title: e.title,
        filename: `${e.type}-${2400 + i}.pdf`,
        storageKey: DEMO_PDF[e.type]!,
        docType: e.type,
        confidence: 0.97,
        source: 'email',
        issuedOn: when.toISOString().slice(0, 10),
        expiresOn: new Date(Date.now() + e.days * DAY).toISOString().slice(0, 10),
        byteSize: 180_000 + Math.floor(random() * 400_000),
        createdAt: when,
      });
      await publishEvent(tx, {
        type: 'documents.filed', actorType: 'system', customerId: idFor(customer),
        subjectType: 'document', subjectId: documentId, occurredAt: when, payload: { title: e.title },
      });
      documents++;
      events++;
    }

    for (const [i, a] of arriving.entries()) {
      const customer = pick(active);
      const when = new Date(Date.now() - a.hoursAgo * 3_600_000);
      const review = i === 2 || i === 6;
      const documentId = await createDocument(tx, {
        customerId: idFor(customer),
        title: a.title,
        filename: filenameFor(a.type, a.source, 4470 + i),
        storageKey: DEMO_PDF[a.type]!,
        docType: a.type,
        confidence: review ? 0.61 : 0.95,
        source: a.source,
        status: review ? 'needs_review' : 'filed',
        issuedOn: when.toISOString().slice(0, 10),
        amount: ['invoice', 'quote'].includes(a.type) ? String(2400 + Math.floor(random() * 40000)) : null,
        byteSize: 90_000 + Math.floor(random() * 900_000),
        createdAt: when,
      });
      await publishEvent(tx, {
        type: 'documents.received', actorType: 'system', customerId: idFor(customer),
        subjectType: 'document', subjectId: documentId, occurredAt: when, payload: { title: a.title },
      });
      await publishEvent(tx, {
        type: review ? 'documents.needs_review' : 'documents.filed',
        actorType: 'system', customerId: idFor(customer), subjectType: 'document', subjectId: documentId,
        occurredAt: new Date(when.getTime() + 40_000), payload: { title: a.title },
      });
      documents++;
      events += 2;
    }
  });

  return { documents, events };
}

/** התאריכים ב-seed נכתבים אחרי היצירה, כי ברירת המחדל היא now(). */
async function withCreatedAt(tx: Tx, table: string, id: string, when: Date) {
  await tx.query(`update ${table} set created_at = $2 where id = $1`, [id, when]);
}

function filenameFor(type: string, source: string, n: number): string {
  if (source === 'scan') return `SCAN_${String(n).padStart(4, '0')}.pdf`;
  if (source === 'whatsapp') return `WhatsApp-${String(n).slice(-4)}.pdf`;
  return `${type}-${n}.pdf`;
}

export async function seedDemo(log: (m: string) => void = console.log): Promise<{
  services: SeedResult;
  commerce: SeedResult;
}> {
  log('זורע דיירי דמו…');

  const services = await seedTenant(
    {
      slug: 'demo-lavi',
      name: 'לביא ושות׳ — משרד עורכי דין',
      businessId: '514872910',
      plan: 'pro',
      // ההרכבה נקבעת מפורשות ולא נגזרת מהחבילה: משרד עורכי דין לא
      // מנהל מלאי, וסעיף בתפריט שמוביל למסך ריק גרוע מסעיף שאינו קיים.
      modules: PRESETS.services.concat('portal'),
      ownerEmail: 'demo@bossi.co.il',
      ownerName: 'נעה לביא',
      staff: [
        { email: 'office@demo-lavi.co.il', name: 'רות מזרחי', role: 'manager' },
        { email: 'books@demo-lavi.co.il', name: 'אבי שרון', role: 'bookkeeper' },
      ],
      customers: SERVICES_CUSTOMERS,
      invoicePrefix: 'חש',
      invoiceBase: 2140,
      invoiceSubjects: [
        'ריטיינר חודשי — ייעוץ משפטי שוטף',
        'ליווי עסקת מקרקעין',
        'הכנת הסכם מייסדים',
        'ייצוג בהליך גישור',
        'בדיקת נאותות — רכישת פעילות',
        'טיפול בתביעה כספית',
        'רישום סימן מסחר',
        'הסכמי עבודה ונספחי סודיות',
      ],
      seed: 20260907,
    },
    log,
  );

  const commerce = await seedTenant(
    {
      slug: 'demo-tavor',
      name: 'תבור אספקה טכנית',
      businessId: '512440817',
      plan: 'mega',
      modules: PRESETS.commerce,
      ownerEmail: 'demo-b2b@bossi.co.il',
      ownerName: 'יוסי תבור',
      staff: [{ email: 'orders@demo-tavor.co.il', name: 'לילך אדרי', role: 'staff' }],
      customers: COMMERCE_CUSTOMERS,
      invoicePrefix: 'ח',
      invoiceBase: 8310,
      invoiceSubjects: [
        'אספקת ברגים וחיזוקים',
        'הזמנת תאורת LED',
        'ציוד חשמל — הזמנה חודשית',
        'סוללות וממירים',
        'חומרי קירור',
        'כלי עבודה ובטיחות',
      ],
      seed: 987654321,
    },
    log,
  );

  return { services, commerce };
}

/** מוחק את דיירי הדמו בלבד. דיירים אמיתיים לא נגעים. */
export async function resetDemo(log: (m: string) => void = console.log): Promise<number> {
  const { rowCount } = await withPlatform((tx) =>
    tx.query('delete from tenants where is_demo = true'),
  );
  log(`  נמחקו ${rowCount ?? 0} דיירי דמו.`);
  return rowCount ?? 0;
}
