import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrincipal, getRetainer, listConsumption, listPeriods } from '@bossi/db';
import { BURN_LABELS, burn, effectiveRate, formatILS, renewalSignal, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ריטיינר' };

/**
 * הריטיינר של לקוח אחד — ובעיקר **ספר הצריכה**.
 *
 * זה המסך שנפתח כשהלקוח שואל "על מה בדיוק שילמתי החודש". תשובה של
 * "27 שעות" אינה תשובה; רשימה של מה נעשה, מתי ועל ידי מי — כן.
 */
export default async function RetainerPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const retainer = await asPrincipal(principal, (tx) => getRetainer(tx, id));
  if (!retainer) notFound();

  const [entries, periods] = await Promise.all([
    retainer.period_id
      ? asPrincipal(principal, (tx) => listConsumption(tx, retainer.period_id!))
      : Promise.resolve([]),
    asPrincipal(principal, (tx) => listPeriods(tx, id)),
  ]);

  const current = retainer.period_id
    ? burn(
        {
          starts_on: retainer.period_starts_on!,
          ends_on: retainer.period_ends_on!,
          quota_amount: retainer.period_quota!,
          status: 'open',
        },
        Number(retainer.period_used),
      )
    : null;
  const rate = effectiveRate(retainer.monthly_fee, Number(retainer.period_used));
  const signal = renewalSignal(retainer);
  const unit = UNITS[retainer.quota_unit] ?? retainer.quota_unit;

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-2 text-[0.78rem] text-muted">
          <Link href="/retainers" className="hover:underline">ריטיינרים</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/customers/${retainer.customer_id}`} className="hover:underline">
            {retainer.customer_name}
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[1.6rem]">{retainer.customer_name}</h1>
          {current ? <StatusPill tone={tone(current.status)}>{BURN_LABELS[current.status]}</StatusPill> : null}
          {signal.kind !== 'none' ? (
            <StatusPill tone={signal.kind === 'notice_passed' ? 'danger' : 'warning'}>{signal.label}</StatusPill>
          ) : null}
        </div>
        <p className="mt-1 text-[0.88rem] text-muted">
          {retainer.name} · מאז {formatDate(retainer.starts_on)}
          {retainer.ends_on ? ` · עד ${formatDate(retainer.ends_on)}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="דמי ריטיינר" value={`${formatILS(toAgorot(retainer.monthly_fee))} ₪`} note="לחודש" />
        <StatTile
          label={`נוצלו החודש`}
          value={current ? `${current.used}` : '—'}
          note={current ? `מתוך ${current.quota} ${unit}` : 'אין תקופה פתוחה'}
        />
        <StatTile
          label="תעריף שעה אפקטיבי"
          value={rate ? `${formatILS(rate)} ₪` : '—'}
          note={rate ? 'מה שבאמת מקבלים לשעה' : 'טרם נרשמה צריכה'}
        />
        <StatTile
          label="נשארו"
          value={current ? String(Math.round(current.remaining * 10) / 10) : '—'}
          note={current ? `${current.daysLeft} ימים בחודש` : ''}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">ספר צריכה — החודש</h2>
            <span className="text-[0.76rem] text-muted">{entries.length} רישומים</span>
          </header>
          {entries.length === 0 ? (
            <p className="px-4 py-10 text-center text-[0.88rem] text-muted">עדיין לא נרשמה צריכה החודש.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-[0.85rem]">
                  <span className="w-16 shrink-0 text-[0.76rem] text-muted">{formatDate(e.occurred_on)}</span>
                  <span className="min-w-0 flex-1">{e.description}</span>
                  {e.user_name ? (
                    <span className="hidden shrink-0 text-[0.72rem] text-muted sm:inline">{e.user_name}</span>
                  ) : null}
                  <span className="w-14 shrink-0 text-end tnum font-medium">{Number(e.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">חודשים קודמים</h2>
            <p className="mt-0.5 text-[0.76rem] text-muted">שחיקה מול מכסה, חודש אחר חודש</p>
          </header>
          <ul className="divide-y divide-hairline">
            {periods.filter((p) => p.id !== retainer.period_id).map((p) => {
              const used = Number(p.used);
              const quota = Number(p.quota_amount);
              const over = used > quota;
              return (
                <li key={p.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-[0.85rem]">
                    <span>{monthLabel(p.starts_on)}</span>
                    <span className="tnum" style={over ? { color: 'var(--danger)' } : undefined}>
                      <bdi>{used} / {quota}</bdi>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full" style={{ background: 'var(--surface-sunken)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((used / (quota || 1)) * 100))}%`,
                        background: over ? 'var(--danger)' : 'var(--positive)',
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

const UNITS: Record<string, string> = { hours: 'שעות', items: 'פריטים', scope: 'היקף' };

function tone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'overrun') return 'danger';
  if (status === 'projected_overrun' || status === 'watch') return 'warning';
  if (status === 'healthy') return 'positive';
  return 'neutral';
}

function monthLabel(value: Date | string): string {
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(value));
}
