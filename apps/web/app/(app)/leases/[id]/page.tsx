import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrincipal, checksForCustomer, getLease, listNotes } from '@bossi/db';
import {
  URGENCY_LABELS, displayStatus, formatILS, leaseTiming, reconcile, toAgorot,
} from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'חוזה שכירות' };

/**
 * חוזה אחד — ובעיקר **מה קורה עם הכסף שלו**.
 *
 * החוזה והצ'קים על מסך אחד בכוונה: השאלה האמיתית על שוכר אינה "מתי
 * נגמר החוזה" אלא "מתי נגמר החוזה ואיך הוא משלם".
 */
export default async function LeasePage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const lease = await asPrincipal(principal, (tx) => getLease(tx, id));
  if (!lease) notFound();

  const [checks, notes] = await Promise.all([
    asPrincipal(principal, (tx) => checksForCustomer(tx, lease.customer_id)),
    asPrincipal(principal, (tx) => listNotes(tx, { customerId: lease.customer_id, limit: 6 })),
  ]);

  const timing = leaseTiming(lease);
  const book = reconcile(checks);
  const open = checks.filter((c) => c.status === 'pending' && new Date(c.due_on) >= new Date());

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-2 text-[0.78rem] text-muted">
          <Link href="/leases" className="hover:underline">חוזי שכירות</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[1.6rem]">{lease.property_name}</h1>
          <StatusPill tone={timing.urgency === 'quiet' ? 'positive' : timing.urgency === 'due' ? 'warning' : 'danger'}>
            {URGENCY_LABELS[timing.urgency]}
          </StatusPill>
        </div>
        <p className="mt-1 text-[0.88rem] text-muted">
          <Link href={`/customers/${lease.customer_id}`} className="hover:underline">{lease.customer_name}</Link>
          {lease.property_address ? ` · ${lease.property_address}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="דמי שכירות" value={`${formatILS(toAgorot(lease.monthly_rent))} ₪`} note="לחודש" />
        <StatTile
          label="מועד ההודעה"
          value={formatDate(timing.noticeDeadline)}
          note={timing.daysToNotice >= 0 ? `בעוד ${timing.daysToNotice} יום` : `חלף לפני ${Math.abs(timing.daysToNotice)} יום`}
        />
        <StatTile label="סיום החוזה" value={formatDate(lease.ends_on)} note={`${timing.daysToEnd} יום`} />
        <StatTile
          label="פיקדון"
          value={lease.deposit_amount ? `${formatILS(toAgorot(lease.deposit_amount))} ₪` : '—'}
          note={lease.option_months ? `אופציה ${lease.option_months} חודשים` : 'ללא אופציה'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">צ׳קים של החוזה</h2>
            <span className="text-[0.76rem] text-muted">{open.length} עוד לא נפרעו</span>
          </header>
          {checks.length === 0 ? (
            <p className="px-4 py-10 text-center text-[0.88rem] text-muted">לא נקלטו צ׳קים לחוזה הזה.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {checks.slice(0, 24).map((c) => {
                const status = displayStatus(c);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[0.85rem]">
                    <span className="w-20 shrink-0 text-[0.76rem] text-muted">{formatDate(c.due_on)}</span>
                    <span className="w-16 shrink-0 tnum text-[0.76rem] text-muted" dir="ltr">
                      {c.check_number ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <StatusPill tone={checkTone(status)}>{CHECK_LABELS[status] ?? status}</StatusPill>
                    </span>
                    <span className="shrink-0 tnum">
                      {c.status === 'partial' && c.cleared_amount ? (
                        <bdi>
                          {formatILS(toAgorot(c.cleared_amount))} / {formatILS(toAgorot(c.amount))}
                        </bdi>
                      ) : (
                        formatILS(toAgorot(c.amount))
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="flex flex-wrap gap-x-6 gap-y-1 border-t border-hairline px-4 py-2.5 text-[0.78rem] text-muted">
            <span>נכנס: <span className="tnum text-secondary">{formatILS(book.received)} ₪</span></span>
            {book.shortfall > 0 ? (
              <span>חסר מפירעון חלקי: <span className="tnum" style={{ color: 'var(--warning)' }}>{formatILS(book.shortfall)} ₪</span></span>
            ) : null}
            {book.bounced > 0 ? (
              <span>חזר: <span className="tnum" style={{ color: 'var(--danger)' }}>{formatILS(book.bounced)} ₪</span></span>
            ) : null}
          </footer>
        </section>

        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">רישומים בתיק</h2>
          </header>
          {notes.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.88rem] text-muted">אין רישומים.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {notes.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <p className="text-[0.85rem] leading-relaxed">{n.body}</p>
                  <p className="mt-1 text-[0.7rem] text-muted">
                    {n.author_name ?? 'המערכת'} · {formatDate(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const CHECK_LABELS: Record<string, string> = {
  overdue: 'עבר מועד — לא אומת',
  due_today: 'לפירעון היום',
  upcoming: 'עתידי',
  cleared: 'נפרע ואומת',
  partial: 'נפרע חלקית',
  bounced: 'חזר',
  void: 'בוטל',
};

function checkTone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'bounced' || status === 'overdue') return 'danger';
  if (status === 'partial' || status === 'due_today') return 'warning';
  if (status === 'cleared') return 'positive';
  return 'neutral';
}
