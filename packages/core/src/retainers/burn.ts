import { daysUntilDate } from '../shared/dates';
import { toAgorot, type Agorot } from '../shared/money';

/**
 * שחיקת ריטיינר.
 *
 * הריטיינר הוא ההסכם, התקופה היא החודש, והצריכה נרשמת לתקופה. שלוש
 * שאלות שהמסך צריך לענות עליהן, בסדר הזה:
 *
 *   1. **כמה נשאר החודש** — ומתי זה ייגמר בקצב הנוכחי. חריגה שמתגלה
 *      ב-28 בחודש היא חריגה; אותה חריגה שנחזתה ב-12 היא שיחה.
 *   2. **כמה באמת מרוויחים מהלקוח הזה** — תעריף שעה אפקטיבי. ריטיינר
 *      של 8,000 ₪ שנשחקות ב-60 שעות הוא 133 ₪ לשעה, וזה מספר שבעל
 *      העסק לא רואה בשום מקום אחר.
 *   3. **מתי לדבר על חידוש** — לפי מועד ההודעה, כמו בחוזה שכירות.
 */

export interface PeriodLike {
  starts_on: Date | string;
  ends_on: Date | string;
  quota_amount: string | number;
  status: string;
}

export type BurnStatus = 'idle' | 'healthy' | 'watch' | 'projected_overrun' | 'overrun';

export interface Burn {
  used: number;
  quota: number;
  remaining: number;
  ratio: number;
  /** אחוז מהתקופה שחלף. משמש להשוואה מול `ratio`. */
  elapsed: number;
  /** צריכה חזויה לסוף התקופה בקצב הנוכחי. */
  projected: number;
  daysLeft: number;
  status: BurnStatus;
}

export const BURN_LABELS: Record<BurnStatus, string> = {
  idle: 'טרם נרשמה צריכה',
  healthy: 'בקצב',
  watch: 'מהיר מהקצב',
  projected_overrun: 'צפוי לחרוג',
  overrun: 'בחריגה',
};

export function burn(period: PeriodLike, usedUnits: number, today = new Date()): Burn {
  const quota = Number(period.quota_amount);
  const starts = new Date(period.starts_on);
  const ends = new Date(period.ends_on);

  const totalDays = Math.max(1, days(starts, ends));
  const passedDays = clamp(days(starts, today), 0, totalDays);
  const elapsed = passedDays / totalDays;
  const daysLeft = Math.max(0, daysUntilDate(ends, today));

  const ratio = quota > 0 ? usedUnits / quota : 0;
  // התחזית לינארית בכוונה. מודל מתוחכם יותר יהיה מדויק פחות ומוסבר
  // פחות, ובעל העסק צריך להאמין למספר כדי להתקשר ללקוח.
  const projected = elapsed > 0 ? round2(usedUnits / elapsed) : usedUnits;

  return {
    used: round2(usedUnits),
    quota,
    remaining: round2(quota - usedUnits),
    ratio: round2(ratio),
    elapsed: round2(elapsed),
    projected,
    daysLeft,
    status: statusOf(usedUnits, quota, ratio, elapsed, projected),
  };
}

function statusOf(used: number, quota: number, ratio: number, elapsed: number, projected: number): BurnStatus {
  if (used === 0) return 'idle';
  if (ratio > 1) return 'overrun';
  if (quota <= 0) return 'healthy';

  // "מהר מהקצב" ו"צפוי לחרוג" הם אות אחד בשתי עוצמות, לא שני אותות:
  // בתחזית לינארית `projected/quota` שווה בדיוק ל-`ratio/elapsed`.
  // עדיף לומר זאת במפורש מאשר להעמיד פנים שיש כאן שתי בדיקות עצמאיות
  // שאחת מהן לעולם לא תידלק.
  //
  // חמישית התקופה הראשונה מנוטרלת: שעתיים ביום הראשון "חוזות" 60 שעות,
  // וזו לא תחזית אלא רעש.
  const pace = elapsed > 0.2 ? ratio / elapsed : 1;

  // 1.15 ולא 1.0, כי צריכה לא מתפזרת אחיד ואזהרה על כל יום עמוס
  // הופכת את המסך לרעש. 1.35 הוא הקו שממנו הפער כבר לא מתיישר לבד.
  if (pace > 1.35 && projected > quota) return 'projected_overrun';
  if (pace > 1.15) return 'watch';
  return 'healthy';
}

/**
 * תעריף שעה אפקטיבי, באגורות. `null` כשעוד לא נרשמה צריכה — חלוקה
 * באפס מחזירה אינסוף, ואינסוף על המסך הוא באג שנראה כמו תובנה.
 */
export function effectiveRate(monthlyFee: string | number, usedUnits: number): Agorot | null {
  if (usedUnits <= 0) return null;
  return Math.round(toAgorot(monthlyFee) / usedUnits);
}

/**
 * האם הגיע הזמן לדבר על חידוש או על מחיר.
 *
 * שני טריגרים נפרדים: מועד ההודעה המוקדמת, ומחיר שלא זז יותר מדי זמן.
 * השני הוא זה ששוכחים — ריטיינר שנקבע ב-2022 ולא עודכן מאז הוא
 * הפסד שקט.
 */
export interface RenewalSignal {
  kind: 'notice_due' | 'notice_passed' | 'price_stale' | 'none';
  label: string;
  days: number;
}

export function renewalSignal(
  retainer: { ends_on?: Date | string | null; notice_days: number; price_updated_on?: Date | string | null; starts_on: Date | string },
  today = new Date(),
  staleMonths = 18,
): RenewalSignal {
  if (retainer.ends_on) {
    const deadline = new Date(retainer.ends_on);
    deadline.setDate(deadline.getDate() - retainer.notice_days);
    const d = daysUntilDate(deadline, today);
    if (d < 0) return { kind: 'notice_passed', label: 'חלון ההודעה נסגר', days: d };
    if (d <= 45) return { kind: 'notice_due', label: 'מועד ההודעה מתקרב', days: d };
  }

  const priceDate = retainer.price_updated_on ?? retainer.starts_on;
  const monthsStale = -daysUntilDate(priceDate, today) / 30.44;
  if (monthsStale >= staleMonths) {
    return { kind: 'price_stale', label: `המחיר לא עודכן ${Math.floor(monthsStale)} חודשים`, days: Math.round(-monthsStale * 30.44) };
  }

  return { kind: 'none', label: '', days: 0 };
}

function days(from: Date | string, to: Date | string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
