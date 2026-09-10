import type { Tx } from '../client';
import { createInvoice, recordDunning, recordPayment, recordPromise } from '../billing';
import { createOrder, createProduct, setStock } from '../commerce';
import { publishEvent } from '../events';
import { invitePortalUser } from '../portal';
import { createRetainer, logConsumption, openPeriod } from '../retainers';
import { createSigningRequest, logSigningEvent, markSigningStatus } from '../signing';

/**
 * שכבת ההדגמה של הכסף והמסחר.
 *
 * העיקרון שמנחה את כל הקובץ: **כל מסך חייב לספר סיפור בשנייה הראשונה.**
 * פיזור אקראי מייצר טבלאות שנראות מלאות ולא אומרות כלום — תור גבייה
 * שכולו "תזכורת", ריטיינרים שכולם "בקצב". לכן כל תרחיש שהמסך אמור
 * להראות נזרע במפורש: לקוח אחד שהבטיח ולא עמד, אחד שדיברנו איתו אתמול,
 * ריטיינר אחד בחריגה ואחד שרק צפוי לחרוג.
 *
 * הכל דטרמיניסטי ויחסי ל"עכשיו", כדי שאפשר יהיה לחזור על אותה הדגמה מחר.
 */

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY);

export interface SeedCustomer {
  id: string;
  name: string;
  terms: number;
  tags: string[];
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════ חיוב וגבייה

/**
 * התרחישים של תור הגבייה, בסדר קבוע.
 *
 * חמשת הראשונים הם התרחישים שהמסך קיים בשבילם; מכאן והלאה — לקוחות
 * שמשלמים, כי עסק שכל לקוחותיו בגבייה אינו עסק אלא אזהרה.
 */
type Profile = 'broken_promise' | 'will_pay' | 'contacted' | 'escalate' | 'late' | 'clean';

const PROFILE_ORDER: Profile[] = ['broken_promise', 'escalate', 'will_pay', 'contacted', 'late'];

export async function seedBilling(
  tx: Tx,
  customers: SeedCustomer[],
  opts: { prefix: string; base: number; random: () => number; subjects: string[] },
): Promise<{ invoices: number; payments: number }> {
  const { random, subjects } = opts;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;

  let number = opts.base;
  let invoices = 0;
  let payments = 0;
  const nextNumber = () => `${opts.prefix}-${number++}`;

  for (const [index, customer] of customers.entries()) {
    const profile: Profile = PROFILE_ORDER[index] ?? 'clean';

    // ── היסטוריה: חשבוניות ישנות שנפרעו במלואן ─────────────────────────
    // בלי זה כרטיס הלקוח מציג רק חוב, וכל לקוח נראה כמו בעיה.
    for (let i = 0; i < between(3, 7); i++) {
      const issued = daysAgo(between(120, 620));
      const amount = String(between(1_800, 26_000) + between(0, 99) / 100);
      const invoiceId = await createInvoice(tx, {
        customerId: customer.id,
        number: nextNumber(),
        amount,
        vatAmount: vat(amount),
        issuedOn: iso(issued),
        dueOn: iso(new Date(issued.getTime() + customer.terms * DAY)),
        subject: pick(subjects),
        source: 'manual',
        status: 'paid',
      });
      await recordPayment(tx, {
        customerId: customer.id,
        amount,
        receivedOn: iso(new Date(issued.getTime() + between(customer.terms - 4, customer.terms + 12) * DAY)),
        method: pick(['transfer', 'transfer', 'transfer', 'check', 'card']),
        reference: `אסמכתא ${between(100000, 999999)}`,
        allocations: [{ invoiceId, amount }],
      });
      invoices++;
      payments++;
    }

    // ── חשבונית שוטפת שטרם הגיע מועדה ──────────────────────────────────
    if (profile !== 'escalate') {
      const issued = daysAgo(between(2, 12));
      const amount = String(between(2_400, 18_000));
      await createInvoice(tx, {
        customerId: customer.id,
        number: nextNumber(),
        amount,
        vatAmount: vat(amount),
        issuedOn: iso(issued),
        dueOn: iso(new Date(issued.getTime() + customer.terms * DAY)),
        subject: pick(subjects),
        source: 'manual',
      });
      invoices++;
    }

    if (profile === 'clean') continue;

    // ── מה שפתוח באיחור, לפי התרחיש ────────────────────────────────────
    const overdue = openInvoicePlan(profile, between);
    const openIds: string[] = [];

    for (const late of overdue) {
      const due = daysAgo(late);
      const issued = new Date(due.getTime() - customer.terms * DAY);
      const amount = String(between(3_200, 24_000));
      const invoiceId = await createInvoice(tx, {
        customerId: customer.id,
        number: nextNumber(),
        amount,
        vatAmount: vat(amount),
        issuedOn: iso(issued),
        dueOn: iso(due),
        subject: pick(subjects),
        source: 'manual',
      });
      openIds.push(invoiceId);
      invoices++;

      await publishEvent(tx, {
        type: 'billing.invoice_overdue',
        actorType: 'system',
        customerId: customer.id,
        subjectType: 'invoice',
        subjectId: invoiceId,
        occurredAt: new Date(due.getTime() + DAY),
        payload: { amount },
      });
    }

    // פירעון חלקי על אחת מהן — יתרה פתוחה שאינה כל הסכום היא המקרה
    // שמערכות פשוטות מציגות שגוי, ולכן היא חייבת להיות בדמו.
    if (profile === 'escalate' && openIds[1]) {
      await recordPayment(tx, {
        customerId: customer.id,
        amount: '2500.00',
        receivedOn: iso(daysAgo(between(14, 40))),
        method: 'transfer',
        reference: 'תשלום על חשבון',
        allocations: [{ invoiceId: openIds[1], amount: '2500.00' }],
      });
      payments++;
    }

    await seedCollectionSignal(tx, customer, profile, openIds[0] ?? null, between);
  }

  return { invoices, payments };
}

/** כמה זמן פתוחה כל חשבונית באיחור, לפי התרחיש. */
function openInvoicePlan(profile: Profile, between: (lo: number, hi: number) => number): number[] {
  switch (profile) {
    case 'broken_promise': return [between(38, 52), between(12, 20)];
    case 'escalate':       return [between(115, 150), between(70, 95), between(35, 50)];
    case 'will_pay':       return [between(20, 34)];
    case 'contacted':      return [between(24, 40), between(8, 14)];
    case 'late':           return [between(5, 12)];
    default:               return [];
  }
}

/** ההבטחה או התזכורת שהופכת את התיק למה שהוא. */
async function seedCollectionSignal(
  tx: Tx,
  customer: SeedCustomer,
  profile: Profile,
  invoiceId: string | null,
  between: (lo: number, hi: number) => number,
): Promise<void> {
  if (profile === 'broken_promise') {
    const promisedFor = daysAgo(between(4, 9));
    await recordPromise(tx, {
      customerId: customer.id,
      invoiceId,
      promisedFor: iso(promisedFor),
      amount: null,
      channel: 'phone',
      notes: 'אמר בטלפון שיעביר עד סוף השבוע.',
    });
    // התזכורת קדמה להבטחה — היא זו שגרמה לה. סדר הפוך היה מסמן
    // "דובר איתו אתמול" ומוריד את התיק מהתור בדיוק כשהוא הכי דחוף.
    await recordDunning(tx, {
      customerId: customer.id, invoiceId, channel: 'phone', tone: 'neutral', step: 2,
      sentAt: new Date(promisedFor.getTime() - between(2, 5) * DAY),
    });
    await publishEvent(tx, {
      type: 'collections.promise_broken', actorType: 'system', customerId: customer.id,
      occurredAt: new Date(promisedFor.getTime() + DAY), payload: {},
    });
    return;
  }

  if (profile === 'will_pay') {
    await recordPromise(tx, {
      customerId: customer.id,
      invoiceId,
      promisedFor: iso(daysAhead(between(3, 8))),
      amount: null,
      channel: 'whatsapp',
      notes: 'ביקש לדחות לתחילת החודש הבא — אושר.',
    });
    await publishEvent(tx, {
      type: 'collections.promise_made', actorType: 'user', customerId: customer.id, payload: {},
    });
    return;
  }

  if (profile === 'contacted') {
    await recordDunning(tx, {
      customerId: customer.id, invoiceId, channel: 'whatsapp', tone: 'soft', step: 1,
      sentAt: daysAgo(1),
    });
    await publishEvent(tx, {
      type: 'collections.reminder_sent', actorType: 'system', customerId: customer.id,
      occurredAt: daysAgo(1), payload: { channel: 'whatsapp' },
    });
    return;
  }

  if (profile === 'escalate') {
    await recordDunning(tx, {
      customerId: customer.id, invoiceId, channel: 'email', tone: 'firm', step: 4,
      sentAt: daysAgo(between(9, 22)),
    });
    await publishEvent(tx, {
      type: 'collections.escalated', actorType: 'user', customerId: customer.id,
      occurredAt: daysAgo(between(8, 20)), payload: {},
    });
  }
}

const vat = (amount: string) => (Math.round(Number(amount) * 18) / 100).toFixed(2);

// ═══════════════════════════════════════════════════════ ריטיינרים

/**
 * ריטיינרים עם היסטוריה של שישה חודשים.
 *
 * התרחישים נזרעים במפורש: אחד בחריגה, אחד שרק צפוי לחרוג, אחד שמחירו
 * לא זז שנתיים. ריטיינר שכולו "בקצב" הוא מסך יפה שלא מסביר למה שילמת
 * עליו.
 */
const RETAINER_WORK = [
  'ייעוץ שוטף — שיחות ומיילים',
  'בדיקת הסכם ספק',
  'טיוטת מכתב התראה',
  'פגישת עבודה במשרד הלקוח',
  'מענה לדרישת רשות המסים',
  'עדכון תקנון והסכמי עבודה',
  'ליווי משא ומתן',
  'בדיקת נאותות מסמכים',
  'הכנת חוות דעת',
  'שיחת ועידה עם הצד השני',
];

type BurnProfile = 'overrun' | 'projected' | 'healthy' | 'quiet';
const BURN_ORDER: BurnProfile[] = ['overrun', 'projected', 'healthy', 'quiet'];

export async function seedRetainers(
  tx: Tx,
  customers: SeedCustomer[],
  opts: { random: () => number; userIds: string[] },
): Promise<number> {
  const { random, userIds } = opts;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;

  const holders = customers.filter((c) => c.tags.includes('ריטיינר'));
  const now = new Date();
  let created = 0;

  for (const [index, customer] of holders.entries()) {
    const profile = BURN_ORDER[index % BURN_ORDER.length]!;
    const quota = pick([10, 12, 15, 20, 25]);
    const fee = quota * pick([320, 360, 400, 450]);

    // הריטיינר הוותיק ביותר הוא זה שהמחיר שלו לא זז — האות שהכי קל
    // לפספס, ולכן זה שחייב להופיע בדמו.
    const stale = index === 0;
    const startedMonthsAgo = stale ? 34 : between(8, 20);
    const startsOn = monthsAgo(startedMonthsAgo);

    const retainerId = await createRetainer(tx, {
      customerId: customer.id,
      name: `ריטיינר חודשי — ${quota} שעות`,
      monthlyFee: `${fee}.00`,
      quotaAmount: `${quota}.00`,
      quotaUnit: 'hours',
      startsOn: iso(startsOn),
      // חוזה עם מועד סיום נותן לראדאר החידושים על מה לרוץ.
      endsOn: index === 1 ? iso(daysAhead(between(38, 60))) : null,
      noticeDays: 30,
      priceUpdatedOn: stale ? iso(monthsAgo(26)) : iso(startsOn),
    });
    created++;

    await publishEvent(tx, {
      type: 'retainers.period_opened', actorType: 'system', customerId: customer.id,
      subjectType: 'retainer', subjectId: retainerId, occurredAt: startsOn, payload: { name: customer.name },
    });

    // ── שישה חודשים אחורה, סגורים ─────────────────────────────────────
    for (let back = 6; back >= 1; back--) {
      const first = monthsAgo(back);
      const periodId = await openPeriod(tx, {
        retainerId,
        startsOn: iso(first),
        endsOn: iso(endOfMonth(first)),
        quotaAmount: `${quota}.00`,
        status: 'billed',
      });
      await fillPeriod(tx, periodId, first, quota * (0.7 + random() * 0.5), { random, userIds });
    }

    // ── החודש הנוכחי, פתוח ────────────────────────────────────────────
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodId = await openPeriod(tx, {
      retainerId,
      startsOn: iso(first),
      endsOn: iso(endOfMonth(first)),
      quotaAmount: `${quota}.00`,
    });

    const elapsed = Math.max(0.15, (now.getDate() - 1) / (endOfMonth(first).getDate() - 1));
    const target = {
      overrun: quota * 1.12,
      projected: quota * elapsed * 1.6,
      healthy: quota * elapsed * 1.02,
      quiet: quota * elapsed * 0.35,
    }[profile];

    await fillPeriod(tx, periodId, first, target, { random, userIds, until: now });

    if (profile === 'overrun') {
      await publishEvent(tx, {
        type: 'retainers.overrun', actorType: 'system', customerId: customer.id,
        subjectType: 'retainer', subjectId: retainerId, occurredAt: daysAgo(between(1, 5)),
        payload: { name: customer.name },
      });
    }
  }

  return created;
}

/** ממלא תקופה בשעות עד לכמות היעד, בקפיצות שנראות כמו יומן אמיתי. */
async function fillPeriod(
  tx: Tx,
  periodId: string,
  first: Date,
  targetHours: number,
  opts: { random: () => number; userIds: string[]; until?: Date },
): Promise<void> {
  const { random, userIds } = opts;
  const last = opts.until ?? endOfMonth(first);
  const span = Math.max(1, Math.round((last.getTime() - first.getTime()) / DAY));

  let remaining = Math.round(targetHours * 4) / 4;
  let guard = 0;
  while (remaining > 0.24 && guard++ < 40) {
    const quantity = Math.min(remaining, [0.5, 0.75, 1, 1.5, 2, 2.5, 3][Math.floor(random() * 7)]!);
    const day = new Date(first.getTime() + Math.floor(random() * span) * DAY);
    await logConsumption(tx, {
      periodId,
      quantity: quantity.toFixed(2),
      description: RETAINER_WORK[Math.floor(random() * RETAINER_WORK.length)]!,
      occurredOn: iso(day),
      userId: userIds.length ? userIds[Math.floor(random() * userIds.length)]! : null,
    });
    remaining = Math.round((remaining - quantity) * 100) / 100;
  }
}

function monthsAgo(n: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// ═══════════════════════════════════════════════════════ קטלוג, מלאי והזמנות

/**
 * קטלוג של ספק אספקה טכנית.
 *
 * המספרים אינם אקראיים: `reorder` נקבע ביחס לקצב מכירה סביר, כדי
 * שמסך המלאי יראה חוסרים אמיתיים ולא צבע אדום שרירותי.
 */
const CATALOG: Array<{
  sku: string; name: string; category: string; unit: string; price: number; cost: number;
  onHand: number; reorder: number; lead: number;
}> = [
  { sku: 'BRG-M8-40',  name: 'בורג ראש משושה M8×40 — גלוון',      category: 'ברגים וחיזוקים', unit: 'ק״ג', price: 38.9,  cost: 24.5,  onHand: 480, reorder: 120, lead: 7 },
  { sku: 'BRG-M10-60', name: 'בורג ראש משושה M10×60 — גלוון',     category: 'ברגים וחיזוקים', unit: 'ק״ג', price: 44.5,  cost: 28.2,  onHand: 96,  reorder: 100, lead: 7 },
  { sku: 'BRG-M12-80', name: 'בורג ראש משושה M12×80 — נירוסטה',   category: 'ברגים וחיזוקים', unit: 'ק״ג', price: 121.0, cost: 82.0,  onHand: 0,   reorder: 60,  lead: 21 },
  { sku: 'DSK-M8',     name: 'דסקית שטוחה M8 — אבץ',              category: 'ברגים וחיזוקים', unit: 'ק״ג', price: 22.0,  cost: 13.4,  onHand: 640, reorder: 150, lead: 5 },
  { sku: 'UM-M8',      name: 'אום נעילה M8 — ניילון',              category: 'ברגים וחיזוקים', unit: 'ק״ג', price: 31.5,  cost: 19.8,  onHand: 140, reorder: 130, lead: 5 },

  { sku: 'KBL-3X2.5',  name: 'כבל חשמל 3×2.5 — גמיש',             category: 'חשמל',          unit: 'מ׳',  price: 9.4,   cost: 6.1,   onHand: 1200, reorder: 400, lead: 10 },
  { sku: 'KBL-5X4',    name: 'כבל חשמל 5×4 — גמיש',               category: 'חשמל',          unit: 'מ׳',  price: 24.8,  cost: 16.9,  onHand: 310,  reorder: 300, lead: 14 },
  { sku: 'MMS-16A',    name: 'מאמ״ת 16A חד-פאזי',                  category: 'חשמל',          unit: 'יח׳', price: 34.0,  cost: 21.0,  onHand: 210,  reorder: 80,  lead: 7 },
  { sku: 'MMS-32A',    name: 'מאמ״ת 32A תלת-פאזי',                 category: 'חשמל',          unit: 'יח׳', price: 128.0, cost: 84.0,  onHand: 42,   reorder: 40,  lead: 12 },
  { sku: 'ARN-12M',    name: 'ארון חשמל 12 מודולים — שקוע',        category: 'חשמל',          unit: 'יח׳', price: 189.0, cost: 121.0, onHand: 28,   reorder: 15,  lead: 14 },

  { sku: 'LED-18W',    name: 'פאנל LED 18W עגול — 4000K',         category: 'תאורה',         unit: 'יח׳', price: 42.0,  cost: 24.0,  onHand: 620, reorder: 200, lead: 21 },
  { sku: 'LED-36W',    name: 'פאנל LED 36W ריבועי — 4000K',       category: 'תאורה',         unit: 'יח׳', price: 68.0,  cost: 41.0,  onHand: 84,  reorder: 90,  lead: 21 },
  { sku: 'PRJ-50W',    name: 'פרוז׳קטור LED 50W — IP65',          category: 'תאורה',         unit: 'יח׳', price: 96.0,  cost: 58.0,  onHand: 156, reorder: 60,  lead: 18 },
  { sku: 'PRJ-150W',   name: 'פרוז׳קטור LED 150W — IP66',         category: 'תאורה',         unit: 'יח׳', price: 268.0, cost: 172.0, onHand: 19,  reorder: 25,  lead: 25 },

  { sku: 'SLL-12V-7',  name: 'סוללת גל עופרת 12V 7Ah',            category: 'סוללות',        unit: 'יח׳', price: 78.0,  cost: 46.0,  onHand: 240, reorder: 80,  lead: 10 },
  { sku: 'SLL-12V-100',name: 'סוללת ג׳ל 12V 100Ah — מחזורית',     category: 'סוללות',        unit: 'יח׳', price: 1240.0,cost: 860.0, onHand: 11,  reorder: 8,   lead: 30 },
  { sku: 'MTN-24V',    name: 'ממיר מתח 24V→12V 20A',              category: 'סוללות',        unit: 'יח׳', price: 310.0, cost: 198.0, onHand: 46,  reorder: 20,  lead: 20 },

  { sku: 'CRR-R410',   name: 'גז קירור R410A — מיכל 11 ק״ג',      category: 'קירור',         unit: 'יח׳', price: 780.0, cost: 545.0, onHand: 14,  reorder: 10,  lead: 15 },
  { sku: 'CRR-FLT',    name: 'מסנן ייבוש 1/4 — נחושת',            category: 'קירור',         unit: 'יח׳', price: 46.0,  cost: 27.0,  onHand: 168, reorder: 60,  lead: 12 },
  { sku: 'CRR-CMP',    name: 'קומפרסור רוטורי 1.5 כ״ס',           category: 'קירור',         unit: 'יח׳', price: 1980.0,cost: 1420.0,onHand: 6,   reorder: 4,   lead: 35 },

  { sku: 'KLI-SET',    name: 'ערכת כלי יד — 42 חלקים',            category: 'כלי עבודה',     unit: 'יח׳', price: 420.0, cost: 268.0, onHand: 37,  reorder: 12,  lead: 20 },
  { sku: 'KLI-MKD',    name: 'מקדחה רוטטת 850W',                  category: 'כלי עבודה',     unit: 'יח׳', price: 640.0, cost: 412.0, onHand: 22,  reorder: 10,  lead: 20 },
  { sku: 'KLI-DSK',    name: 'דיסק חיתוך מתכת 125 מ״מ',           category: 'כלי עבודה',     unit: 'יח׳', price: 6.9,   cost: 3.4,   onHand: 1840,reorder: 500, lead: 8 },
  { sku: 'KLI-SGR',    name: 'משקפי מגן — פוליקרבונט',            category: 'כלי עבודה',     unit: 'יח׳', price: 18.0,  cost: 9.2,   onHand: 95,  reorder: 100, lead: 8 },
];

export async function seedCommerce(
  tx: Tx,
  customers: SeedCustomer[],
  opts: { random: () => number },
): Promise<{ products: number; orders: number }> {
  const { random } = opts;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

  const ids = new Map<string, string>();
  for (const p of CATALOG) {
    const id = await createProduct(tx, {
      sku: p.sku, name: p.name, category: p.category, unit: p.unit,
      listPrice: p.price.toFixed(2), costPrice: p.cost.toFixed(2),
    });
    ids.set(p.sku, id);
    await setStock(tx, {
      productId: id,
      onHand: p.onHand.toFixed(2),
      allocated: '0',
      reorderPoint: p.reorder.toFixed(2),
      leadDays: p.lead,
    });
  }

  // ── מחיר פר-לקוח ────────────────────────────────────────────────────
  // רק ללקוחות הגדולים, ורק על מה שהם באמת קונים — מחירון מלא לכל
  // לקוח הוא בדיוק מה שאין באף עסק אמיתי.
  const bigSpenders = customers.slice(0, 4);
  for (const [i, customer] of bigSpenders.entries()) {
    for (const p of CATALOG.slice(i * 3, i * 3 + 4)) {
      const discount = 0.88 - i * 0.02;
      await tx.query(
        `insert into customer_prices (tenant_id, customer_id, product_id, price, min_quantity)
         values (current_tenant(), $1, $2, $3, $4)
         on conflict do nothing`,
        [customer.id, ids.get(p.sku), (p.price * discount).toFixed(2), i === 0 ? 50 : 1],
      );
    }
  }

  // ── הזמנות ──────────────────────────────────────────────────────────
  //
  // כל שער אישור מיוצג פעם אחת: אחת ממתינה נקייה, אחת שנעצרת על מלאי,
  // אחת שנעצרת על חוב, ואחריהן היסטוריה של הזמנות שאושרו ונשלחו.
  let orderNumber = 4200;
  let orders = 0;

  const place = async (
    customer: SeedCustomer,
    skus: string[],
    o: { status: string; daysAgo: number; channel?: string; hold?: string | null; placedBy?: string },
  ) => {
    const lines = skus.map((sku) => {
      const product = CATALOG.find((p) => p.sku === sku)!;
      const isBulk = product.unit !== 'יח׳';
      return {
        productId: ids.get(sku)!,
        sku,
        name: product.name,
        quantity: isBulk ? String(between(20, 140)) : String(between(2, 40)),
        unitPrice: (product.price * (0.86 + random() * 0.12)).toFixed(2),
      };
    });
    await createOrder(tx, {
      customerId: customer.id,
      number: `הז-${orderNumber++}`,
      channel: o.channel ?? 'portal',
      status: o.status,
      placedAt: daysAgo(o.daysAgo),
      placedBy: o.placedBy ?? null,
      neededBy: iso(daysAhead(between(3, 14))),
      holdReason: o.hold ?? null,
      lines,
    });
    orders++;
    await publishEvent(tx, {
      type: o.status === 'pending' ? 'orders.placed'
          : o.status === 'shipped' ? 'orders.shipped' : 'orders.approved',
      actorType: o.channel === 'portal' ? 'portal_user' : 'user',
      customerId: customer.id,
      occurredAt: daysAgo(o.daysAgo),
      payload: { number: `הז-${orderNumber - 1}` },
    });
  };

  // הפריסה מכוונת לכך שכל תוצאה של שער האישור תופיע פעם אחת. חשוב
  // במיוחד שתהיה **אחת נקייה**: מסך שכל ההזמנות בו חסומות מלמד שהמערכת
  // חוסמת, לא שהיא יודעת להבחין.
  //
  // הלקוחות עם חוב הם חמשת הראשונים (ראה PROFILE_ORDER), ולכן ההזמנה
  // הנקייה נלקחת מהסוף.
  const withDebt = customers.slice(0, PROFILE_ORDER.length);
  const clean = customers.slice(PROFILE_ORDER.length);

  const [d0, d1, d2] = withDebt;
  const [k0, k1, k2] = clean;

  if (k0) await place(k0, ['BRG-M8-40', 'DSK-M8', 'UM-M8'], { status: 'pending', daysAgo: 0, placedBy: 'איציק לוי' });
  if (d0) await place(d0, ['LED-36W', 'PRJ-150W', 'MMS-32A'], { status: 'pending', daysAgo: 1, placedBy: 'רם ביטון' });
  if (d1) await place(d1, ['BRG-M12-80', 'KLI-DSK'], { status: 'pending', daysAgo: 1, placedBy: 'ניסים חדד' });
  if (k1) await place(k1, ['KBL-5X4', 'ARN-12M'], { status: 'pending', daysAgo: 2, channel: 'phone' });
  if (d2) await place(d2, ['SLL-12V-100', 'MTN-24V'], { status: 'approved', daysAgo: 4, placedBy: 'אורן שפירא' });
  if (k2) await place(k2, ['LED-18W', 'PRJ-50W'], { status: 'shipped', daysAgo: 9, placedBy: 'ענת כרמי' });

  for (const customer of customers) {
    for (let i = 0; i < between(1, 3); i++) {
      const skus = [...CATALOG].sort(() => random() - 0.5).slice(0, between(2, 5)).map((p) => p.sku);
      await place(customer, skus, {
        status: 'shipped',
        daysAgo: between(15, 210),
        channel: random() < 0.7 ? 'portal' : 'phone',
      });
    }
  }

  return { products: CATALOG.length, orders };
}

// ═══════════════════════════════════════════════════════ פורטל

export async function seedPortalUsers(
  tx: Tx,
  customers: SeedCustomer[],
  opts: { random: () => number; permissions: string[] },
): Promise<number> {
  const { random } = opts;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

  const { rows } = await tx.query<{ customer_id: string; name: string; email: string | null; roles: string[] }>(
    `select customer_id, name, email, roles from contacts
      where email is not null order by is_primary desc, name`,
  );
  const allowed = new Set(customers.map((c) => c.id));

  let created = 0;
  for (const [i, contact] of rows.entries()) {
    if (!allowed.has(contact.customer_id)) continue;
    if (i % 3 === 2) continue;   // לא כל איש קשר מקבל גישה

    // שניים "הוזמנו ולא נכנסו" — זו בדיוק הרשימה שמסך הפורטל קיים
    // בשבילה, ולכן היא לא יכולה להיות ריקה.
    const invited = created === 1 || created === 4;
    await invitePortalUser(tx, {
      customerId: contact.customer_id,
      email: contact.email!,
      name: contact.name,
      permissions: contact.roles.includes('orders')
        ? opts.permissions
        : opts.permissions.filter((p) => !p.startsWith('orders')),
      status: invited ? 'invited' : 'active',
      invitedAt: daysAgo(between(20, 300)),
      lastSeenAt: invited ? null : daysAgo(between(0, 25)),
    });
    created++;
  }

  return created;
}

// ═══════════════════════════════════════════════════════ החתמה

/**
 * בקשות חתימה בכל המצבים שיש להן.
 *
 * "נשלח ולא נפתח" ו"נפתח ולא נחתם" הם שני מצבים שונים לגמרי מבחינת מה
 * שעושים איתם, ולכן שניהם חייבים להופיע. נתיב הביקורת נזרע מלא — חתימה
 * דיגיטלית רגילה בלי נתיב ביקורת אינה שווה דבר בוויכוח.
 */
export async function seedSigning(
  tx: Tx,
  targets: Array<{ customerId: string; customerName: string; title: string; phone?: string | null; email?: string | null; documentId?: string | null }>,
  opts: { random: () => number },
): Promise<number> {
  const { random } = opts;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

  // הפריסה: 2 נחתמו, 2 נפתחו ולא נחתמו, 2 לא נפתחו כלל, 1 סירב, 1 פג.
  const plan: Array<{ status: 'signed' | 'viewed' | 'sent' | 'declined' | 'expired'; ago: number }> = [
    { status: 'viewed', ago: 4 },
    { status: 'sent', ago: 2 },
    { status: 'viewed', ago: 9 },
    { status: 'sent', ago: 6 },
    { status: 'signed', ago: 12 },
    { status: 'declined', ago: 17 },
    { status: 'signed', ago: 26 },
    { status: 'expired', ago: 40 },
  ];

  let created = 0;
  for (const [i, target] of targets.slice(0, plan.length).entries()) {
    const step = plan[i]!;
    const sentAt = daysAgo(step.ago);

    const { id } = await createSigningRequest(tx, {
      customerId: target.customerId,
      documentId: target.documentId ?? null,
      title: target.title,
      signerName: target.customerName,
      signerEmail: target.email ?? null,
      signerPhone: target.phone ?? null,
      ttlDays: 14,
      sentAt,
      status: 'sent',
    });
    created++;

    if (step.status === 'sent') continue;

    const viewedAt = new Date(sentAt.getTime() + between(2, 40) * 3_600_000);
    await logSigningEvent(tx, { requestId: id, kind: 'viewed', ip: fakeIp(random), occurredAt: viewedAt });
    await markSigningStatus(tx, id, 'viewed', { at: viewedAt });

    if (step.status === 'viewed') {
      // תזכורת אחרי שלושה ימים בלי חתימה — כמו שהמודול מבטיח.
      if (step.ago >= 6) {
        const remindedAt = new Date(viewedAt.getTime() + 3 * DAY);
        await logSigningEvent(tx, { requestId: id, kind: 'reminded', occurredAt: remindedAt });
        await tx.query(
          'update signing_requests set reminded_at = $2, reminder_count = reminder_count + 1 where id = $1',
          [id, remindedAt],
        );
      }
      continue;
    }

    if (step.status === 'declined') {
      const at = new Date(viewedAt.getTime() + between(1, 20) * 3_600_000);
      await logSigningEvent(tx, { requestId: id, kind: 'declined', ip: fakeIp(random), occurredAt: at });
      await markSigningStatus(tx, id, 'declined', { at, reason: 'ביקש לתקן את סעיף ההצמדה לפני שיחתום.' });
      continue;
    }

    if (step.status === 'expired') {
      await logSigningEvent(tx, { requestId: id, kind: 'expired', occurredAt: new Date(sentAt.getTime() + 14 * DAY) });
      await markSigningStatus(tx, id, 'expired', { at: new Date(sentAt.getTime() + 14 * DAY) });
      continue;
    }

    const otpAt = new Date(viewedAt.getTime() + between(1, 8) * 60_000);
    const signedAt = new Date(otpAt.getTime() + between(2, 15) * 60_000);
    const ip = fakeIp(random);
    await logSigningEvent(tx, { requestId: id, kind: 'otp_sent', occurredAt: otpAt, detail: { to: target.phone ?? '' } });
    await logSigningEvent(tx, { requestId: id, kind: 'otp_verified', ip, occurredAt: new Date(otpAt.getTime() + 90_000) });
    await logSigningEvent(tx, { requestId: id, kind: 'signed', ip, occurredAt: signedAt });
    await markSigningStatus(tx, id, 'signed', { at: signedAt, ip });

    await publishEvent(tx, {
      type: 'signing.signed', actorType: 'system', customerId: target.customerId,
      subjectType: 'signing_request', subjectId: id, occurredAt: signedAt,
      payload: { title: target.title },
    });
  }

  return created;
}

function fakeIp(random: () => number): string {
  return `82.${Math.floor(random() * 255)}.${Math.floor(random() * 255)}.${Math.floor(random() * 255)}`;
}
