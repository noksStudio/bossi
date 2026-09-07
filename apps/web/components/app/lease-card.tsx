import { leaseTiming, URGENCY_LABELS, type LeaseUrgency } from '@bossi/core';
import type { LeaseRow } from '@bossi/db';
import { StatusPill } from '@/components/site/chrome';

const TONE: Record<LeaseUrgency, 'danger' | 'warning' | 'positive' | 'neutral'> = {
  passed: 'danger',
  critical: 'danger',
  due: 'warning',
  upcoming: 'warning',
  quiet: 'positive',
  ended: 'neutral',
};

/**
 * החוזה הפעיל של השוכר.
 *
 * המספר הגדול הוא **הימים למועד ההודעה המוקדמת**, לא לתאריך הסיום —
 * זה התאריך שממנו כבר אי אפשר לשנות כלום.
 */
export function LeaseCard({ lease }: { lease: LeaseRow }) {
  const t = leaseTiming(lease);
  const tone = TONE[t.urgency];
  const showCountdown = ['passed', 'critical', 'due', 'upcoming'].includes(t.urgency);

  return (
    <section className="rounded-lg border border-hairline">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">החוזה</h2>
        <StatusPill tone={tone}>{URGENCY_LABELS[t.urgency]}</StatusPill>
      </header>

      <div className="px-4 py-3.5">
        <div className="text-[0.95rem] font-medium">{lease.property_name}</div>
        {lease.property_address ? (
          <div className="text-[0.78rem] text-muted">{lease.property_address}</div>
        ) : null}

        <dl className="mt-3.5 space-y-1.5 text-[0.85rem]">
          <Row label="שכר דירה">
            <span className="tnum font-semibold">{ils(lease.monthly_rent)}</span> לחודש
          </Row>
          <Row label="תקופה">
            <span className="tnum">{date(lease.starts_on)} – {date(lease.ends_on)}</span>
          </Row>
          <Row label="הודעה מוקדמת">
            {lease.notice_days} יום · עד <span className="tnum">{date(t.noticeDeadline)}</span>
          </Row>
          {lease.deposit_amount ? (
            <Row label="פיקדון"><span className="tnum">{ils(lease.deposit_amount)}</span></Row>
          ) : null}
          {lease.option_months ? <Row label="אופציה">{lease.option_months} חודשים</Row> : null}
        </dl>

        {showCountdown ? (
          <div
            className="mt-3.5 rounded-md px-3 py-2.5 text-[0.85rem] leading-relaxed"
            style={{
              background: tone === 'danger' ? 'var(--danger-quiet)' : 'var(--warning-quiet)',
              color: tone === 'danger' ? 'var(--danger)' : 'var(--warning)',
            }}
          >
            {countdown(t.daysToNotice, t.daysToEnd)}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** הניסוח נגזר מהמצב, כי "בעוד 12- ימים" הוא לא משפט. */
function countdown(daysToNotice: number, daysToEnd: number): string {
  if (daysToEnd < 0) return `החוזה נגמר לפני ${Math.abs(daysToEnd)} יום ואיש לא נגע בו.`;
  if (daysToNotice < 0)
    return `חלון ההודעה נסגר לפני ${Math.abs(daysToNotice)} יום. החוזה מסתיים בעוד ${daysToEnd} יום.`;
  if (daysToNotice === 0) return 'היום הוא היום האחרון להודיע על שינוי או סיום.';
  return `נשארו ${daysToNotice} יום להודיע על שינוי או סיום. החוזה מסתיים בעוד ${daysToEnd} יום.`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function ils(v: string): string {
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Number(v))} ₪`;
}

function date(v: Date | string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jerusalem',
  }).format(new Date(v));
}
