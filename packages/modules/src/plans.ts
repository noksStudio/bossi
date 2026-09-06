import type { ModuleId } from '@bossi/kernel';

/**
 * חבילות Bossi — התמחור של המערכת עצמה מול בעל העסק.
 *
 * החבילה קובעת שני דברים: אילו מודולים נדלקים, וכמה מותר לצרוך.
 * מכיוון שהמודולים כבר הרכבה (ADR-003), החבילה היא בסך הכול רשימת מודולים + מכסות —
 * ולא ענף נפרד בקוד.
 *
 * מחירים בשקלים לחודש, ללא מע"מ וללא דמי הקמה.
 */

export type PlanId = 'starter' | 'pro' | 'mega';

/** מדדי צריכה. מתאפסים בכל מחזור חיוב, למעט `storage_gb` ו-`seats` שהם מצב רגעי. */
export type MeterId =
  | 'storage_gb'
  | 'documents_processed'
  | 'ocr_pages'
  | 'emails_sent'
  | 'whatsapp_messages'
  | 'ai_operations'
  | 'seats'
  | 'portal_users'
  | 'active_customers';

export interface MeterSpec {
  readonly id: MeterId;
  readonly label: string;
  readonly unit: string;
  /** `stock` = מצב רגעי (אחסון, מושבים). `flow` = נצבר ומתאפס כל מחזור. */
  readonly kind: 'stock' | 'flow';
}

export const METERS: Record<MeterId, MeterSpec> = {
  storage_gb: { id: 'storage_gb', label: 'אחסון', unit: 'GB', kind: 'stock' },
  documents_processed: { id: 'documents_processed', label: 'מסמכים שעובדו', unit: 'מסמכים', kind: 'flow' },
  ocr_pages: { id: 'ocr_pages', label: 'עמודי OCR', unit: 'עמודים', kind: 'flow' },
  emails_sent: { id: 'emails_sent', label: 'מיילים', unit: 'הודעות', kind: 'flow' },
  whatsapp_messages: { id: 'whatsapp_messages', label: 'הודעות WhatsApp', unit: 'הודעות', kind: 'flow' },
  ai_operations: { id: 'ai_operations', label: 'פעולות AI', unit: 'פעולות', kind: 'flow' },
  seats: { id: 'seats', label: 'משתמשי צוות', unit: 'משתמשים', kind: 'stock' },
  portal_users: { id: 'portal_users', label: 'משתמשי פורטל', unit: 'משתמשים', kind: 'stock' },
  active_customers: { id: 'active_customers', label: 'לקוחות פעילים', unit: 'לקוחות', kind: 'stock' },
};

export interface Quota {
  /** `null` = ללא הגבלה. */
  readonly limit: number | null;
  /** מחיר ליחידה מעבר למכסה, בשקלים. `null` = חסימה במקום חיוב חריגה. */
  readonly overagePrice: number | null;
}

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly tagline: string;
  readonly monthlyPrice: number;
  readonly setupFee: number | null;
  readonly modules: ModuleId[];
  readonly quotas: Record<MeterId, Quota>;
  readonly highlights: string[];
}

const q = (limit: number | null, overagePrice: number | null = null): Quota => ({ limit, overagePrice });

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter Boss',
    tagline: 'כל הלקוחות והמסמכים במקום אחד, וכל דבר נמצא בשנייה.',
    monthlyPrice: 497,
    setupFee: null,
    modules: ['documents', 'search', 'billing', 'collections', 'metering'],
    quotas: {
      storage_gb: q(20, 9),
      documents_processed: q(300, 0.4),
      ocr_pages: q(600, 0.2),
      emails_sent: q(1_000, 0.05),
      whatsapp_messages: q(0, null),
      ai_operations: q(500, 0.1),
      seats: q(2, 89),
      portal_users: q(0, null),
      active_customers: q(50, null),
    },
    highlights: [
      'כרטיס לקוח עם ציר זמן מלא',
      'קליטת מסמכים ממייל ייעודי',
      'תיוק אוטומטי ומעקב תוקף',
      'חיפוש מלא בכל המסמכים',
      'גבייה עם תזכורות ולינקי תשלום',
    ],
  },

  pro: {
    id: 'pro',
    name: 'Boss Pro',
    tagline: 'הדשבורד מסדר את היום, והמערכת מתחילה לעבוד לבד.',
    monthlyPrice: 1_490,
    setupFee: null,
    modules: ['documents', 'search', 'billing', 'collections', 'retainers', 'alerts', 'portal', 'metering'],
    quotas: {
      storage_gb: q(150, 7),
      documents_processed: q(2_000, 0.3),
      ocr_pages: q(5_000, 0.15),
      emails_sent: q(10_000, 0.04),
      whatsapp_messages: q(500, 0.25),
      ai_operations: q(5_000, 0.08),
      seats: q(8, 79),
      portal_users: q(50, 6),
      active_customers: q(300, null),
    },
    highlights: [
      'כל מה שב-Starter Boss',
      'דשבורד יומי — מה דורש אותך',
      'חיפוש עם ציטוט מהמקור',
      'ריטיינרים עם תחזית שחיקה',
      'תעריף שעה אפקטיבי וראדאר חידושים',
      'התראות חכמות ודייג\'סט בוקר',
      'פורטל מסמכים ללקוחות',
      'תזכורות ב-WhatsApp',
    ],
  },

  mega: {
    id: 'mega',
    name: 'Mega Bossi',
    tagline: 'המערכת המלאה — כולל פורטל הזמנות מחובר למלאי.',
    monthlyPrice: 2_990,
    setupFee: null,
    modules: [
      'documents', 'search', 'billing', 'collections', 'retainers',
      'catalog', 'inventory', 'orders', 'portal', 'alerts', 'metering',
    ],
    quotas: {
      storage_gb: q(750, 5),
      documents_processed: q(10_000, 0.2),
      ocr_pages: q(25_000, 0.1),
      emails_sent: q(50_000, 0.03),
      whatsapp_messages: q(3_000, 0.2),
      ai_operations: q(30_000, 0.06),
      seats: q(25, 69),
      portal_users: q(500, 4),
      active_customers: q(null),
    },
    highlights: [
      'כל מה שב-Boss Pro',
      'קטלוג ומחירון פר-לקוח',
      'מלאי זמין והקצאה אוטומטית',
      'פורטל הזמנות עם עגלה',
      'הזמנה חוזרת חכמה',
      'סנכרון מול ERP',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['starter', 'pro', 'mega'];

/** מכסה שנחצתה. `hard` = חסימה, `soft` = חיוב חריגה. */
export interface QuotaBreach {
  readonly meter: MeterId;
  readonly used: number;
  readonly limit: number;
  readonly kind: 'hard' | 'soft';
  readonly overageUnits: number;
  readonly overageCharge: number;
}

/**
 * בודק צריכה מול חבילה. פונקציה טהורה — כל חישוב כספי כאן ולא במודל שפה
 * (CLAUDE.md כלל 3).
 */
export function evaluateUsage(plan: Plan, usage: Partial<Record<MeterId, number>>): {
  breaches: QuotaBreach[];
  totalOverage: number;
  blocked: MeterId[];
} {
  const breaches: QuotaBreach[] = [];

  for (const meterId of Object.keys(METERS) as MeterId[]) {
    const quota = plan.quotas[meterId];
    const used = usage[meterId] ?? 0;
    if (quota.limit === null || used <= quota.limit) continue;

    const overageUnits = used - quota.limit;
    const hard = quota.overagePrice === null;
    breaches.push({
      meter: meterId,
      used,
      limit: quota.limit,
      kind: hard ? 'hard' : 'soft',
      overageUnits,
      overageCharge: hard ? 0 : round2(overageUnits * quota.overagePrice!),
    });
  }

  return {
    breaches,
    totalOverage: round2(breaches.reduce((sum, b) => sum + b.overageCharge, 0)),
    blocked: breaches.filter((b) => b.kind === 'hard').map((b) => b.meter),
  };
}

/** אחוז ניצול, לתצוגת מד. `null` כשאין מכסה. */
export function utilisation(plan: Plan, meter: MeterId, used: number): number | null {
  const limit = plan.quotas[meter].limit;
  if (limit === null) return null;
  if (limit === 0) return used > 0 ? 1 : 0;
  return used / limit;
}

/** החבילה הזולה ביותר שמכילה את כל המודולים המבוקשים. */
export function smallestPlanFor(modules: ModuleId[]): Plan | null {
  for (const id of PLAN_ORDER) {
    const plan = PLANS[id];
    if (modules.every((m) => plan.modules.includes(m))) return plan;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
