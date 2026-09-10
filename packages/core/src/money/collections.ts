import { daysUntilDate } from '../shared/dates';
import { openBalance, daysOverdue, type InvoiceLike } from './receivables';
import type { Agorot } from '../shared/money';

/**
 * על מי להתקשר היום.
 *
 * הרשימה אינה ממוינת לפי גובה החוב. חוב גדול של לקוח שמשלם באיחור של
 * שבוע כל חודש הוא לא בעיה; חוב בינוני של מי שהבטיח ולא עמד — הוא כן.
 *
 * הניקוד מורכב משלושה אותות, בסדר החשיבות הזה:
 *
 *   1. **הבטחה שהופרה.** האות הכי חזק שיש. מי שאמר "אשלם ביום ראשון"
 *      ולא שילם, לא ישלם גם בלי שיחה.
 *   2. **כמה זמן החוב פתוח.** מתחת ל-90 יום גובים; מעל — מתחילים לוותר.
 *   3. **גובה החוב** — משפיע, אבל אחרון. הוא קובע מי קודם בין שווים.
 *
 * ומול כל אלה, שני בלמים: לקוח שדיברנו איתו אתמול לא חוזר לרשימה
 * מחר, ולקוח שהבטיח ועוד לא הגיע המועד — לא מציקים לו.
 */

export interface CollectionCase {
  customerId: string;
  customerName: string;
  balance: Agorot;
  oldestDays: number;
  invoiceCount: number;
  /** ההבטחה הפתוחה או האחרונה שהופרה. */
  promise?: { promisedFor: Date | string; status: string } | null;
  lastContactAt?: Date | string | null;
  paused?: boolean;
}

export type CollectionAction = 'call_now' | 'escalate' | 'remind' | 'wait_promise' | 'recently_contacted' | 'paused';

export interface ScoredCase extends CollectionCase {
  score: number;
  action: CollectionAction;
  reason: string;
}

export const ACTION_LABELS: Record<CollectionAction, string> = {
  call_now: 'להתקשר היום',
  escalate: 'להסלים',
  remind: 'תזכורת',
  wait_promise: 'ממתין להבטחה',
  recently_contacted: 'דובר לאחרונה',
  paused: 'גבייה מושהית',
};

export function scoreCase(c: CollectionCase, today = new Date()): ScoredCase {
  const promiseDays = c.promise ? daysUntilDate(c.promise.promisedFor, today) : null;
  const promiseBroken = c.promise?.status === 'broken' || (c.promise?.status === 'open' && promiseDays !== null && promiseDays < 0);
  const contactDays = c.lastContactAt ? -daysUntilDate(c.lastContactAt, today) : null;

  // הבטחה שהופרה שווה 60 יום איחור. זה יחס מכוון: היא מקפיצה תיק
  // צעיר מעל תיקים ותיקים יותר, כי היא אומרת משהו על הכוונה ולא על הזמן.
  const ageScore = Math.min(c.oldestDays, 120);
  const promiseScore = promiseBroken ? 60 : 0;
  // הכסף נכנס לוגריתמית: פי עשרה חוב אינו פי עשרה דחיפות.
  const moneyScore = c.balance > 0 ? Math.min(30, Math.log10(c.balance / 100 + 1) * 8) : 0;

  const score = Math.round(ageScore + promiseScore + moneyScore);

  return { ...c, score, ...decide(c, { promiseDays, promiseBroken, contactDays }) };
}

function decide(
  c: CollectionCase,
  ctx: { promiseDays: number | null; promiseBroken: boolean; contactDays: number | null },
): { action: CollectionAction; reason: string } {
  if (c.paused) return { action: 'paused', reason: 'הגבייה מהלקוח הושהתה ידנית' };

  if (ctx.promiseBroken) {
    return { action: 'call_now', reason: 'הבטיח לשלם ולא עמד בזה' };
  }
  if (c.promise?.status === 'open' && ctx.promiseDays !== null && ctx.promiseDays >= 0) {
    return {
      action: 'wait_promise',
      reason:
        ctx.promiseDays === 0 ? 'הבטיח לשלם היום'
        : ctx.promiseDays === 1 ? 'הבטיח לשלם מחר'
        : `הבטיח לשלם בעוד ${ctx.promiseDays} ימים`,
    };
  }
  if (ctx.contactDays !== null && ctx.contactDays <= 3) {
    return { action: 'recently_contacted', reason: `נשלחה תזכורת ${agoLabel(ctx.contactDays)}` };
  }
  if (c.oldestDays > 90) {
    return { action: 'escalate', reason: `חוב פתוח ${c.oldestDays} יום — מעבר לסולם הרגיל` };
  }
  if (c.oldestDays > 14) {
    return { action: 'call_now', reason: `החוב הוותיק פתוח ${c.oldestDays} יום` };
  }
  return { action: 'remind', reason: 'איחור קל — תזכורת מספיקה' };
}

/** התור, מהדחוף לפחות. מי שאין מה לעשות איתו יורד לתחתית. */
export function collectionQueue(cases: CollectionCase[], today = new Date()): ScoredCase[] {
  const rank: Record<CollectionAction, number> = {
    call_now: 0, escalate: 1, remind: 2, wait_promise: 3, recently_contacted: 4, paused: 5,
  };
  return cases
    .map((c) => scoreCase(c, today))
    .sort((a, b) => rank[a.action] - rank[b.action] || b.score - a.score);
}

/** מקבץ חשבוניות פתוחות לתיקי גבייה — תיק אחד ללקוח. */
export function casesFromInvoices(
  invoices: Array<InvoiceLike & { customer_id: string; customer_name: string }>,
  today = new Date(),
): CollectionCase[] {
  const byCustomer = new Map<string, CollectionCase>();

  for (const invoice of invoices) {
    const balance = openBalance(invoice);
    const late = daysOverdue(invoice, today);
    if (balance === 0 || late <= 0) continue;

    const existing = byCustomer.get(invoice.customer_id);
    if (existing) {
      existing.balance += balance;
      existing.invoiceCount += 1;
      existing.oldestDays = Math.max(existing.oldestDays, late);
    } else {
      byCustomer.set(invoice.customer_id, {
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        balance,
        oldestDays: late,
        invoiceCount: 1,
      });
    }
  }

  return [...byCustomer.values()];
}

/** "לפני 0 ימים" הוא תאריך נכון ועברית שבורה. */
function agoLabel(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}
