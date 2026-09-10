import Link from 'next/link';
import { asPrincipal, listRetainers } from '@bossi/db';
import {
  BURN_LABELS, burn, effectiveRate, formatILS, renewalSignal, toAgorot,
  type BurnStatus,
} from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ריטיינרים' };

/**
 * ריטיינרים — שלוש שאלות, בסדר הזה:
 *
 *   · מי עומד לחרוג החודש (וכדאי להתקשר אליו **לפני** שזה קורה);
 *   · כמה באמת מרוויחים מכל לקוח — תעריף שעה אפקטיבי, המספר שאף
 *     מערכת אחרת לא מציגה;
 *   · מי מתקרב למועד ההודעה, ומי שהמחיר שלו לא זז שנתיים.
 */
export default async function RetainersPage() {
  const principal = await requirePrincipal();
  const retainers = await asPrincipal(principal, (tx) => listRetainers(tx, { status: 'active' }));

  const rows = retainers.map((r) => {
    const period = r.period_id
      ? burn(
          { starts_on: r.period_starts_on!, ends_on: r.period_ends_on!, quota_amount: r.period_quota!, status: 'open' },
          Number(r.period_used),
        )
      : null;
    return {
      ...r,
      period,
      rate: effectiveRate(r.monthly_fee, Number(r.period_used)),
      signal: renewalSignal(r),
    };
  });

  const atRisk = rows.filter((r) => r.period && (r.period.status === 'overrun' || r.period.status === 'projected_overrun'));
  const monthlyRevenue = rows.reduce((s, r) => s + toAgorot(r.monthly_fee), 0);
  const signals = rows.filter((r) => r.signal.kind !== 'none');

  // תעריף השעה הממוצע נשקלל בכסף ולא בלקוחות: לקוח קטן עם שעה אחת
  // יקרה לא אמור להסתיר חמישה לקוחות גדולים שנשחקים.
  const totalHours = rows.reduce((s, r) => s + Number(r.period_used), 0);
  const blendedRate = totalHours > 0 ? Math.round(monthlyRevenue / totalHours) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">ריטיינרים</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {atRisk.length === 0
            ? 'אף ריטיינר לא בדרך לחריגה החודש.'
            : `${atRisk.length} ${atRisk.length === 1 ? 'ריטיינר' : 'ריטיינרים'} בחריגה או בדרך לשם.`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="הכנסה חודשית קבועה" value={`${formatILS(monthlyRevenue)} ₪`} note={`${rows.length} ריטיינרים`} />
        <StatTile
          label="תעריף שעה אפקטיבי"
          value={blendedRate ? `${formatILS(blendedRate)} ₪` : '—'}
          note="ממוצע משוקלל החודש"
        />
        <StatTile label="בחריגה או בדרך" value={String(atRisk.length)} note={atRisk.length ? 'שווה שיחה' : 'הכול בקצב'} />
        <StatTile label="דורש החלטה" value={String(signals.length)} note="חידוש או עדכון מחיר" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.05rem]">עדיין אין ריטיינרים</h2>
          <p className="mx-auto mt-2 max-w-md text-[0.88rem] leading-relaxed text-secondary">
            ריטיינר הוא הסכם חודשי עם מכסה. ברגע שיוגדר, כל שעה שתירשם תיספר מולו —
            והמערכת תתריע לפני חריגה ולא אחריה.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">שחיקה החודש</h2>
            <p className="mt-0.5 text-[0.76rem] text-muted">
              הפס מראה את הניצול; הקו הדק את מקום היום בחודש. פס שעבר את הקו — מהיר מהקצב.
            </p>
          </header>
          <ul className="divide-y divide-hairline">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/retainers/${r.id}`} className="text-[0.95rem] font-medium hover:underline">
                        {r.customer_name}
                      </Link>
                      {r.period ? (
                        <StatusPill tone={burnTone(r.period.status)}>{BURN_LABELS[r.period.status]}</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">אין תקופה פתוחה</StatusPill>
                      )}
                      {r.signal.kind !== 'none' ? (
                        <StatusPill tone={r.signal.kind === 'notice_passed' ? 'danger' : 'warning'}>
                          {r.signal.label}
                        </StatusPill>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[0.78rem] text-muted">
                      {r.name} · {formatILS(toAgorot(r.monthly_fee))} ₪ לחודש
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <div className="tnum text-[1.05rem] font-semibold leading-none">
                      {/* <bdi> ולא טקסט חופשי: "10 / 20" בפסקה בעברית מתהפך
                          ל-"20 / 10", והקורא רואה את המכסה במקום הניצול. */}
                      {r.period ? <bdi>{r.period.used} / {r.period.quota}</bdi> : '—'}
                      <span className="ms-1 text-[0.7rem] font-normal text-muted">{unitLabel(r.quota_unit)}</span>
                    </div>
                    <div className="mt-1 text-[0.72rem] text-muted">
                      {r.rate ? `${formatILS(r.rate)} ₪ לשעה בפועל` : 'טרם נרשמה צריכה'}
                    </div>
                  </div>
                </div>

                {r.period ? <BurnBar burn={r.period} /> : null}

                {r.period && r.period.status === 'projected_overrun' ? (
                  <p className="mt-2 text-[0.78rem]" style={{ color: 'var(--warning)' }}>
                    בקצב הזה יסתיים החודש על {r.period.projected} {unitLabel(r.quota_unit)} —
                    חריגה של {Math.round((r.period.projected - r.period.quota) * 10) / 10}.
                    נשארו {r.period.daysLeft} ימים.
                  </p>
                ) : null}
                {r.period && r.period.status === 'overrun' ? (
                  <p className="mt-2 text-[0.78rem]" style={{ color: 'var(--danger)' }}>
                    חריגה של {Math.round(Math.abs(r.period.remaining) * 10) / 10} {unitLabel(r.quota_unit)} כבר עכשיו.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** הפס: ניצול מול הקו שמסמן איפה אנחנו בחודש. */
function BurnBar({ burn: b }: { burn: NonNullable<ReturnType<typeof burn>> }) {
  const width = Math.min(100, Math.round(b.ratio * 100));
  return (
    <div className="relative mt-3 h-2 rounded-full" style={{ background: 'var(--surface-sunken)' }}>
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${width}%`, background: barColor(b.status) }}
      />
      <div
        className="absolute top-[-3px] h-[14px] w-px"
        style={{ insetInlineStart: `${Math.round(b.elapsed * 100)}%`, background: 'var(--text-muted)' }}
        aria-hidden="true"
      />
    </div>
  );
}

function burnTone(status: BurnStatus): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'overrun') return 'danger';
  if (status === 'projected_overrun' || status === 'watch') return 'warning';
  if (status === 'healthy') return 'positive';
  return 'neutral';
}

function barColor(status: BurnStatus): string {
  if (status === 'overrun') return 'var(--danger)';
  if (status === 'projected_overrun' || status === 'watch') return 'var(--warning)';
  return 'var(--positive)';
}

const UNITS: Record<string, string> = { hours: 'שעות', items: 'פריטים', scope: 'היקף' };
const unitLabel = (u: string) => UNITS[u] ?? u;
