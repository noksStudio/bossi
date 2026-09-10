import { daysUntilDate } from '../shared/dates';
import { sum, toAgorot, type Agorot } from '../shared/money';

/**
 * חשבונות פתוחים — מה חייבים לנו וכמה זמן.
 *
 * **היתרה נגזרת ולא נשמרת.** `amount - sum(allocations)`. סכום ששמור
 * בשני מקומות מתפצל, ואז אף אחד לא יודע איזה מהם נכון — וזה בדיוק
 * הסכום שמופיע במכתב לעורך דין.
 *
 * העמודות הן 30/60/90 כי זה מה שרואה החשבון של בעל העסק מבין. שינוי
 * לחלוקה "חכמה" יותר רק יגרום לו לא לסמוך על המסך.
 */

export interface InvoiceLike {
  id: string;
  amount: string | number;
  /** סך ההקצאות שכבר נזקפו לחשבונית. */
  paid_amount?: string | number | null;
  due_on: Date | string;
  status: string;
}

export type AgeBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export const BUCKET_LABELS: Record<AgeBucket, string> = {
  current: 'טרם הגיע מועד',
  d1_30: 'עד 30 יום',
  d31_60: '31–60 יום',
  d61_90: '61–90 יום',
  d90_plus: 'מעל 90 יום',
};

export const BUCKET_ORDER: AgeBucket[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];

/** מה עוד פתוח בחשבונית. חשבונית מבוטלת או שנמחקה כחוב אינה חוב. */
export function openBalance(invoice: InvoiceLike): Agorot {
  if (invoice.status === 'void' || invoice.status === 'written_off' || invoice.status === 'draft') return 0;
  const balance = toAgorot(invoice.amount) - toAgorot(invoice.paid_amount ?? 0);
  return balance > 0 ? balance : 0;
}

/** כמה ימים החשבונית באיחור. 0 או פחות = טרם הגיע המועד. */
export function daysOverdue(invoice: InvoiceLike, today = new Date()): number {
  return -daysUntilDate(invoice.due_on, today);
}

export function bucketOf(invoice: InvoiceLike, today = new Date()): AgeBucket {
  const late = daysOverdue(invoice, today);
  if (late <= 0) return 'current';
  if (late <= 30) return 'd1_30';
  if (late <= 60) return 'd31_60';
  if (late <= 90) return 'd61_90';
  return 'd90_plus';
}

export interface Aging {
  buckets: Record<AgeBucket, { amount: Agorot; count: number }>;
  total: Agorot;
  overdue: Agorot;
  overdueCount: number;
  /** גיל ממוצע משוקלל בכסף. "כמה זמן הכסף שלי אצל אחרים." */
  weightedAgeDays: number;
}

export function aging(invoices: InvoiceLike[], today = new Date()): Aging {
  const buckets = Object.fromEntries(
    BUCKET_ORDER.map((b) => [b, { amount: 0, count: 0 }]),
  ) as Aging['buckets'];

  let total = 0;
  let overdue = 0;
  let overdueCount = 0;
  let weighted = 0;

  for (const invoice of invoices) {
    const balance = openBalance(invoice);
    if (balance === 0) continue;

    const bucket = bucketOf(invoice, today);
    buckets[bucket].amount += balance;
    buckets[bucket].count += 1;
    total += balance;

    const late = daysOverdue(invoice, today);
    if (late > 0) {
      overdue += balance;
      overdueCount += 1;
      weighted += balance * late;
    }
  }

  return {
    buckets,
    total,
    overdue,
    overdueCount,
    weightedAgeDays: overdue > 0 ? Math.round(weighted / overdue) : 0,
  };
}

/** סך התקבולים בטווח. משמש לכותרת "נכנס החודש". */
export function received(payments: Array<{ amount: string | number }>): Agorot {
  return sum(payments.map((p) => toAgorot(p.amount)));
}
