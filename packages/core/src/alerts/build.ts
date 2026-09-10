import { daysUntilDate } from '../shared/dates';
import { displayStatus, type CheckLike } from '../checks/reconciliation';
import { leaseTiming, type LeaseLike } from '../leases/renewal';

/**
 * מנוע ההתראות.
 *
 * פונקציה טהורה שמקבלת את מה שהמודולים הפעילים מספקים ומחזירה רשימה
 * אחת מתועדפת. מודול כבוי פשוט לא מעביר קלט, ולכן אין כאן שום תנאי
 * שיודע מי דלוק.
 *
 * שני עקרונות שקובעים הכל:
 *   · **דחיפות לפי כמה זמן נשאר, לא לפי סוג.** צ'ק שחזר אתמול דוחק
 *     אישור ביטוח שפג בעוד חודשיים.
 *   · **כל התראה נושאת יעד.** התראה שאי אפשר ללחוץ עליה היא רעש.
 */

export type AlertKind =
  | 'check_bounced' | 'check_overdue'
  | 'document_expired' | 'document_expiring'
  | 'lease_passed' | 'lease_notice_closed' | 'lease_notice_due' | 'lease_ending'
  | 'document_review' | 'customer_quiet';

export type Severity = 'critical' | 'attention' | 'info';

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  detail: string;
  href: string;
  customerId?: string;
  customerName?: string;
  /** ימים עד/מאז. שלילי = כבר קרה. משמש למיון בתוך אותה חומרה. */
  days: number;
  action?: string;
}

export interface AlertInputs {
  documents?: Array<{
    id: string; title: string; expires_on: Date | string | null;
    status: string; customer_id: string | null; customer_name: string | null;
  }>;
  checks?: Array<CheckLike & {
    id: string; customer_id: string; customer_name: string | null;
    check_number: string | null;
  }>;
  leases?: Array<LeaseLike & {
    id: string; customer_id: string; customer_name: string;
    property_name: string;
  }>;
  quietCustomers?: Array<{ id: string; display_name: string; days_quiet: number }>;
}

const RANK: Record<Severity, number> = { critical: 0, attention: 1, info: 2 };

export function buildAlerts(inputs: AlertInputs, today = new Date()): Alert[] {
  const alerts: Alert[] = [];

  // ── צ'קים ───────────────────────────────────────────────────────────────
  for (const c of inputs.checks ?? []) {
    const status = displayStatus(c, today);
    const who = c.customer_name ?? '';
    const num = c.check_number ? `צ׳ק ${c.check_number}` : 'צ׳ק';

    if (status === 'bounced') {
      alerts.push({
        id: `check-bounced-${c.id}`, kind: 'check_bounced', severity: 'critical',
        title: `${num} של ${who} חזר`,
        detail: `${ils(c.amount)} לא נכנסו. יש ליצור קשר ולקבל תחליף.`,
        href: `/customers/${c.customer_id}/checks`,
        customerId: c.customer_id, customerName: who,
        days: daysUntilDate(c.due_on, today), action: 'פתח כרטיס',
      });
    } else if (status === 'overdue') {
      const late = Math.abs(daysUntilDate(c.due_on, today));
      alerts.push({
        id: `check-overdue-${c.id}`, kind: 'check_overdue',
        severity: late > 14 ? 'critical' : 'attention',
        title: `${num} של ${who} עבר מועד ולא אומת`,
        detail: `${ils(c.amount)} · היה אמור להיפרע לפני ${late} יום. לבדוק מול הבנק.`,
        href: '/checks',
        customerId: c.customer_id, customerName: who,
        days: -late, action: 'למסך הצ׳קים',
      });
    }
  }

  // ── מסמכים ──────────────────────────────────────────────────────────────
  for (const d of inputs.documents ?? []) {
    if (d.status === 'needs_review') {
      alerts.push({
        id: `doc-review-${d.id}`, kind: 'document_review', severity: 'info',
        title: `״${d.title}״ ממתין לאישור סיווג`,
        detail: 'המערכת לא בטוחה בסיווג. אישור לוקח שנייה.',
        href: `/documents/${d.id}`,
        customerId: d.customer_id ?? undefined, customerName: d.customer_name ?? undefined,
        days: 0, action: 'פתח מסמך',
      });
      continue;
    }
    if (!d.expires_on) continue;

    const days = daysUntilDate(d.expires_on, today);
    if (days > 60) continue;

    alerts.push({
      id: `doc-exp-${d.id}`,
      kind: days < 0 ? 'document_expired' : 'document_expiring',
      severity: days < 0 ? 'critical' : days <= 21 ? 'attention' : 'info',
      title: days < 0
        ? `״${d.title}״ של ${d.customer_name ?? ''} כבר פג`
        : `״${d.title}״ של ${d.customer_name ?? ''} פג בעוד ${days} יום`,
      detail: days < 0
        ? `פג לפני ${Math.abs(days)} יום ואיש לא ביקש חדש.`
        : 'כדאי לבקש מסמך מעודכן לפני שהוא פג.',
      href: `/documents/${d.id}`,
      customerId: d.customer_id ?? undefined, customerName: d.customer_name ?? undefined,
      days, action: 'בקש חדש',
    });
  }

  // ── חוזי שכירות ─────────────────────────────────────────────────────────
  for (const l of inputs.leases ?? []) {
    const t = leaseTiming(l, today);
    if (t.urgency === 'quiet' || t.urgency === 'ended') continue;

    const base = {
      id: `lease-${l.id}`, href: `/leases/${l.id}`,
      customerId: l.customer_id, customerName: l.customer_name,
    };

    if (t.urgency === 'passed') {
      alerts.push({
        ...base, kind: 'lease_passed', severity: 'critical',
        title: `החוזה של ${l.customer_name} נגמר ואיש לא נגע`,
        detail: `${l.property_name} · הסתיים לפני ${Math.abs(t.daysToEnd)} יום.`,
        days: t.daysToEnd, action: 'פתח חוזה',
      });
    } else if (t.urgency === 'critical') {
      alerts.push({
        ...base, kind: 'lease_notice_closed', severity: 'critical',
        title: `חלון ההודעה של ${l.customer_name} נסגר`,
        detail: `${l.property_name} · המועד חלף לפני ${Math.abs(t.daysToNotice)} יום, החוזה מסתיים בעוד ${t.daysToEnd}.`,
        days: t.daysToNotice, action: 'פתח חוזה',
      });
    } else if (t.urgency === 'due') {
      alerts.push({
        ...base, kind: 'lease_notice_due', severity: 'attention',
        title: `נשארו ${t.daysToNotice} יום להודיע — ${l.customer_name}`,
        detail: `${l.property_name} · אחרי המועד כבר אי אפשר לשנות תנאים או לסיים.`,
        days: t.daysToNotice, action: 'פתח חוזה',
      });
    } else {
      alerts.push({
        ...base, kind: 'lease_ending', severity: 'info',
        title: `החוזה של ${l.customer_name} מסתיים בעוד ${t.daysToEnd} יום`,
        detail: `${l.property_name} · מועד ההודעה בעוד ${t.daysToNotice} יום.`,
        days: t.daysToEnd, action: 'פתח חוזה',
      });
    }
  }

  // ── לקוחות שנשכחו ───────────────────────────────────────────────────────
  for (const c of inputs.quietCustomers ?? []) {
    alerts.push({
      id: `quiet-${c.id}`, kind: 'customer_quiet', severity: 'info',
      title: `${c.display_name} — לא קרה כלום ${c.days_quiet >= 999 ? 'מעולם' : `${c.days_quiet} יום`}`,
      detail: 'לקוח פעיל שנעלם מהרדאר.',
      href: `/customers/${c.id}`,
      customerId: c.id, customerName: c.display_name,
      days: -c.days_quiet, action: 'פתח כרטיס',
    });
  }

  return alerts.sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || a.days - b.days || a.title.localeCompare(b.title, 'he'),
  );
}

export function countBySeverity(alerts: Alert[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, attention: 0, info: 0 };
  for (const a of alerts) counts[a.severity]++;
  return counts;
}

/** שלושת הדברים שדורשים אותך היום — ולא יותר. */
export function topThree(alerts: Alert[]): Alert[] {
  return alerts.filter((a) => a.severity !== 'info').slice(0, 3);
}

function ils(amount: string): string {
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Number(amount))} ₪`;
}
