import { sum, toAgorot, type Agorot } from '../shared/money';

/**
 * לוגיקת ההתאמה החודשית של צ'קים דחויים.
 *
 * הכול כאן פונקציות טהורות: הן לא יודעות מה זה מסד ומה זה HTTP, והן
 * מכוסות בבדיקות. חישוב כספי הוא הדבר היחיד שאסור לו להיות מקורב.
 */

export type CheckStatus = 'pending' | 'cleared' | 'partial' | 'bounced' | 'void';

export interface CheckLike {
  id: string;
  amount: string;
  due_on: Date | string;
  status: CheckStatus;
  cleared_amount: string | null;
}

/**
 * המצב **לתצוגה**, שאינו זהה למצב במסד: צ'ק שעבר את תאריך הפירעון
 * ועדיין לא סומן הוא `overdue`, וזה הפריט שחייב לצוף.
 */
export type DisplayStatus = CheckStatus | 'overdue' | 'due_today' | 'upcoming';

export function displayStatus(check: CheckLike, today = new Date()): DisplayStatus {
  if (check.status !== 'pending') return check.status;

  const due = startOfDay(new Date(check.due_on));
  const now = startOfDay(today);
  if (due < now) return 'overdue';
  if (due.getTime() === now.getTime()) return 'due_today';
  return 'upcoming';
}

export interface ReconciliationSummary {
  /** סך הצ'קים שאמורים להיפרע בתקופה. */
  expected: Agorot;
  /** מה שנפרע בפועל — כולל פירעונות חלקיים. */
  received: Agorot;
  /** הפרש שנוצר מפירעון חלקי. יתרה פתוחה שלא נעלמת. */
  shortfall: Agorot;
  /** צ'קים שחזרו. */
  bounced: Agorot;
  /** טרם סומנו, כולל אלה שעברו תאריך. */
  outstanding: Agorot;
  counts: Record<DisplayStatus, number>;
  /** האם נותר משהו לטפל בו. */
  settled: boolean;
}

const EMPTY_COUNTS = (): Record<DisplayStatus, number> => ({
  pending: 0, cleared: 0, partial: 0, bounced: 0, void: 0,
  overdue: 0, due_today: 0, upcoming: 0,
});

export function reconcile(checks: CheckLike[], today = new Date()): ReconciliationSummary {
  const counts = EMPTY_COUNTS();
  const live = checks.filter((c) => c.status !== 'void');

  for (const c of checks) counts[displayStatus(c, today)]++;

  const expected = sum(live.map((c) => toAgorot(c.amount)));

  const received = sum(
    live
      .filter((c) => c.status === 'cleared' || c.status === 'partial')
      .map((c) => (c.status === 'partial' ? toAgorot(c.cleared_amount) : toAgorot(c.amount))),
  );

  // רק פירעון חלקי מייצר חוסר. צ'ק שחזר אינו "חסר" — הוא חוב מלא.
  const shortfall = sum(
    live
      .filter((c) => c.status === 'partial')
      .map((c) => toAgorot(c.amount) - toAgorot(c.cleared_amount)),
  );

  const bounced = sum(live.filter((c) => c.status === 'bounced').map((c) => toAgorot(c.amount)));
  const outstanding = sum(live.filter((c) => c.status === 'pending').map((c) => toAgorot(c.amount)));

  return {
    expected,
    received,
    shortfall,
    bounced,
    outstanding,
    counts,
    settled: counts.overdue === 0 && counts.due_today === 0 && counts.pending === 0,
  };
}

/** מה שדורש טיפול עכשיו: עבר תאריך, מגיע היום, או חזר. */
export function needsAttention(checks: CheckLike[], today = new Date()): CheckLike[] {
  return checks.filter((c) => {
    const s = displayStatus(c, today);
    return s === 'overdue' || s === 'due_today' || s === 'bounced';
  });
}

/** חלון החודש שאליו שייך תאריך — לגלגול הרשימה מחודש לחודש. */
export function monthWindow(anchor: Date): { from: string; to: string; label: string } {
  const from = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(from),
  };
}

export function shiftMonth(anchor: Date, months: number): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
