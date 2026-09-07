/**
 * ראדאר חידושים לחוזי שכירות.
 *
 * הנקודה המרכזית: **ההתראה רצה על מועד ההודעה המוקדמת, לא על תאריך
 * הסיום.** חוזה שנגמר ב-31.12 עם 90 יום הודעה כבר בוער ב-2.10 —
 * התראה שמגיעה בדצמבר מגיעה כשכבר אין מה לעשות.
 */

export interface LeaseLike {
  id: string;
  ends_on: Date | string;
  notice_days: number;
  status: string;
}

export type LeaseUrgency = 'passed' | 'critical' | 'due' | 'upcoming' | 'quiet' | 'ended';

export interface LeaseTiming {
  endsOn: Date;
  noticeDeadline: Date;
  daysToEnd: number;
  daysToNotice: number;
  urgency: LeaseUrgency;
}

export function leaseTiming(lease: LeaseLike, today = new Date()): LeaseTiming {
  const endsOn = startOfDay(new Date(lease.ends_on));
  const noticeDeadline = new Date(endsOn);
  noticeDeadline.setDate(noticeDeadline.getDate() - lease.notice_days);

  const now = startOfDay(today);
  const daysToEnd = daysBetween(now, endsOn);
  const daysToNotice = daysBetween(now, noticeDeadline);

  return { endsOn, noticeDeadline, daysToEnd, daysToNotice, urgency: urgencyOf(lease, daysToEnd, daysToNotice) };
}

function urgencyOf(lease: LeaseLike, daysToEnd: number, daysToNotice: number): LeaseUrgency {
  if (lease.status === 'ended' || lease.status === 'cancelled') return 'ended';
  if (daysToEnd < 0) return 'passed';          // החוזה נגמר ואף אחד לא נגע
  if (daysToNotice < 0) return 'critical';     // חלון ההודעה נסגר
  if (daysToNotice <= 30) return 'due';        // נשאר חודש להחליט
  if (daysToEnd <= 120) return 'upcoming';     // ראובן ביקש שלושה חודשים מראש
  return 'quiet';
}

export const URGENCY_LABELS: Record<LeaseUrgency, string> = {
  passed: 'החוזה נגמר',
  critical: 'חלון ההודעה נסגר',
  due: 'מועד ההודעה מתקרב',
  upcoming: 'לקראת סיום',
  quiet: 'בתוקף',
  ended: 'הסתיים',
};

/** חוזים שדורשים החלטה — הסדר הוא סדר הדחיפות. */
export function needsDecision(leases: LeaseLike[], today = new Date()): Array<LeaseLike & { timing: LeaseTiming }> {
  const rank: Record<LeaseUrgency, number> = {
    passed: 0, critical: 1, due: 2, upcoming: 3, quiet: 4, ended: 5,
  };
  return leases
    .map((l) => ({ ...l, timing: leaseTiming(l, today) }))
    .filter((l) => ['passed', 'critical', 'due', 'upcoming'].includes(l.timing.urgency))
    .sort((a, b) => rank[a.timing.urgency] - rank[b.timing.urgency] || a.timing.daysToNotice - b.timing.daysToNotice);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
