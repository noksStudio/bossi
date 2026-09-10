import Link from 'next/link';
import { asPrincipal, listLeases } from '@bossi/db';
import { URGENCY_LABELS, formatILS, leaseTiming, toAgorot, type LeaseUrgency } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'חוזי שכירות' };

/**
 * ראדאר החידושים.
 *
 * **המיון הוא לפי מועד ההודעה המוקדמת, לא לפי תאריך הסיום.** חוזה
 * שנגמר ב-31.12 עם 90 יום הודעה כבר בוער ב-2.10 — רשימה שממוינת לפי
 * תאריך הסיום תציג אותו רגוע בדיוק בשבוע שבו עוד אפשר לעשות משהו.
 */
export default async function LeasesPage() {
  const principal = await requirePrincipal();
  const leases = await asPrincipal(principal, (tx) => listLeases(tx));

  const rows = leases
    .map((l) => ({ ...l, timing: leaseTiming(l) }))
    .sort((a, b) => RANK[a.timing.urgency] - RANK[b.timing.urgency] || a.timing.daysToNotice - b.timing.daysToNotice);

  const active = rows.filter((r) => r.status === 'active');
  const monthlyIncome = active.reduce((s, r) => s + toAgorot(r.monthly_rent), 0);
  const decisions = rows.filter((r) => ['passed', 'critical', 'due'].includes(r.timing.urgency));

  const groups: Array<{ keys: LeaseUrgency[]; title: string; hint: string }> = [
    { keys: ['passed', 'critical'], title: 'דורש טיפול מיידי', hint: 'החוזה נגמר או שחלון ההודעה המוקדמת כבר נסגר' },
    { keys: ['due'], title: 'מועד ההודעה מתקרב', hint: 'עוד אפשר להודיע על סיום או לפתוח משא ומתן על חידוש' },
    { keys: ['upcoming'], title: 'לקראת סיום', hint: 'בטווח שלושת החודשים — כדאי להתחיל לחשוב' },
    { keys: ['quiet', 'ended'], title: 'שקטים', hint: 'בתוקף, אין מה לעשות איתם עכשיו' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">חוזי שכירות</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {decisions.length === 0
            ? 'אין חוזה שדורש החלטה בשבועות הקרובים.'
            : `${decisions.length} ${decisions.length === 1 ? 'חוזה דורש' : 'חוזים דורשים'} החלטה.`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="חוזים פעילים" value={String(active.length)} />
        <StatTile label="הכנסה חודשית" value={`${formatILS(monthlyIncome)} ₪`} note="מדמי שכירות" />
        <StatTile label="דורש החלטה" value={String(decisions.length)} note="לפי מועד ההודעה" />
        <StatTile
          label="לקראת סיום"
          value={String(rows.filter((r) => r.timing.urgency === 'upcoming').length)}
          note="בשלושת החודשים הקרובים"
        />
      </div>

      {groups.map((g) => {
        const items = rows.filter((r) => g.keys.includes(r.timing.urgency));
        if (items.length === 0) return null;
        return (
          <section key={g.title} className="overflow-hidden rounded-lg border border-hairline">
            <header className="border-b border-hairline px-4 py-3">
              <h2 className="text-[0.98rem]">
                {g.title} <span className="tnum text-[0.8rem] text-muted">({items.length})</span>
              </h2>
              <p className="mt-0.5 text-[0.76rem] text-muted">{g.hint}</p>
            </header>
            <ul className="divide-y divide-hairline">
              {items.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <StatusPill tone={tone(l.timing.urgency)}>{URGENCY_LABELS[l.timing.urgency]}</StatusPill>
                  <div className="min-w-0 flex-1">
                    <Link href={`/leases/${l.id}`} className="text-[0.9rem] hover:underline">
                      {l.property_name}
                    </Link>
                    <div className="text-[0.74rem] text-muted">
                      <Link href={`/customers/${l.customer_id}`} className="hover:underline">
                        {l.customer_name}
                      </Link>
                      {' · '}
                      {noticeLine(l.timing)}
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <div className="tnum text-[0.92rem] font-medium">{formatILS(toAgorot(l.monthly_rent))} ₪</div>
                    <div className="text-[0.72rem] text-muted">עד {formatDate(l.ends_on)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const RANK: Record<LeaseUrgency, number> = {
  passed: 0, critical: 1, due: 2, upcoming: 3, quiet: 4, ended: 5,
};

function tone(u: LeaseUrgency): 'danger' | 'warning' | 'positive' | 'neutral' {
  if (u === 'passed' || u === 'critical') return 'danger';
  if (u === 'due') return 'warning';
  if (u === 'upcoming') return 'neutral';
  return 'positive';
}

function noticeLine(timing: { daysToNotice: number; noticeDeadline: Date }): string {
  if (timing.daysToNotice < 0) return `מועד ההודעה חלף לפני ${Math.abs(timing.daysToNotice)} יום`;
  if (timing.daysToNotice === 0) return 'מועד ההודעה הוא היום';
  return `${timing.daysToNotice} יום עד מועד ההודעה`;
}
