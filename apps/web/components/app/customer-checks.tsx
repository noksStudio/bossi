import Link from 'next/link';
import { displayStatus, formatILS, reconcile, toAgorot, type DisplayStatus } from '@bossi/core';
import type { CheckRow, NoteRow } from '@bossi/db';

const TONE: Record<DisplayStatus, { bg: string; fg: string; label: string }> = {
  overdue:   { bg: 'var(--danger-quiet)',   fg: 'var(--danger)',     label: 'עבר מועד' },
  due_today: { bg: 'var(--warning-quiet)',  fg: 'var(--warning)',    label: 'היום' },
  upcoming:  { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'עתידי' },
  pending:   { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'ממתין' },
  cleared:   { bg: 'var(--positive-quiet)', fg: 'var(--positive)',   label: 'נפרע' },
  partial:   { bg: 'var(--warning-quiet)',  fg: 'var(--warning)',    label: 'חלקי' },
  bounced:   { bg: 'var(--danger-quiet)',   fg: 'var(--danger)',     label: 'חזר' },
  void:      { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'בוטל' },
};

/**
 * היסטוריית התשלומים של השוכר — הסיבה שנכנסים לכרטיס.
 *
 * הרישומים שנכתבו על צ'ק מסוים מוצגים **מתחת לאותו צ'ק** ולא בתיקייה
 * נפרדת: "הועבר 2,000 במקום 2,200" חסר משמעות רחוק מהשורה שהוא מסביר.
 */
export function CustomerChecks({
  checks,
  notes,
  href,
  limit = 8,
}: {
  checks: CheckRow[];
  notes: NoteRow[];
  href: string;
  limit?: number;
}) {
  if (checks.length === 0) return null;

  const summary = reconcile(checks);
  const paidToDate = summary.received;
  const notesByCheck = new Map<string, NoteRow[]>();
  for (const n of notes) {
    if (n.subject_type !== 'check' || !n.subject_id) continue;
    notesByCheck.set(n.subject_id, [...(notesByCheck.get(n.subject_id) ?? []), n]);
  }

  const shown = checks.slice(0, limit);

  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">תשלומים</h2>
        <span className="text-[0.75rem] text-muted">
          {checks.length === 1 ? 'צ׳ק אחד' : `${checks.length} צ׳קים`}
        </span>
      </header>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline border-b border-hairline sm:grid-cols-4">
        <Tile label="שולם עד היום" value={formatILS(paidToDate)} />
        <Tile label="פתוח" value={formatILS(summary.outstanding)} tone={summary.outstanding > 0 ? 'warning' : undefined} />
        <Tile label="חסר מחלקי" value={formatILS(summary.shortfall)} tone={summary.shortfall > 0 ? 'warning' : undefined} />
        <Tile label="חזר" value={formatILS(summary.bounced)} tone={summary.bounced > 0 ? 'danger' : undefined} />
      </div>

      <ul className="divide-y divide-hairline">
        {shown.map((c) => {
          const status = displayStatus(c);
          const tone = TONE[status];
          const linked = notesByCheck.get(c.id) ?? [];
          const missing = c.status === 'partial' && c.cleared_amount
            ? toAgorot(c.amount) - toAgorot(c.cleared_amount)
            : 0;

          return (
            <li key={c.id} className="px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className="w-[4.2rem] shrink-0 rounded-full px-2 py-0.5 text-center text-[0.66rem] font-medium"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {tone.label}
                </span>
                <span className="tnum w-20 shrink-0 text-[0.8rem] text-muted">{date(c.due_on)}</span>
                <span className="min-w-0 flex-1 truncate text-[0.75rem] text-muted">
                  {c.check_number ? <span dir="ltr">צ׳ק {c.check_number}</span> : null}
                  {c.bank_name ? ` · ${c.bank_name}` : ''}
                </span>
                <span className="tnum shrink-0 text-[0.88rem] font-semibold">{ils(c.amount)}</span>
              </div>

              {missing > 0 ? (
                <div className="mt-1 ps-[5.2rem] text-[0.75rem]" style={{ color: 'var(--warning)' }}>
                  נכנס {ils(c.cleared_amount!)} · <strong>נותרה יתרה של {formatILS(missing)} ₪</strong>
                </div>
              ) : null}

              {c.cleared_by_name ? (
                <div className="mt-0.5 ps-[5.2rem] text-[0.7rem] text-muted">
                  אומת ע״י {c.cleared_by_name} ב-{date(c.cleared_on ?? c.due_on)}
                </div>
              ) : null}

              {linked.map((n) => (
                <p
                  key={n.id}
                  className="mt-1.5 ms-[5.2rem] rounded-md bg-sunken px-2.5 py-1.5 text-[0.78rem] leading-relaxed text-secondary"
                >
                  {n.body}
                  <span className="ms-1.5 text-[0.7rem] text-muted">— {n.author_name ?? 'המערכת'}</span>
                </p>
              ))}
            </li>
          );
        })}
      </ul>

      {checks.length > shown.length ? (
        <Link
          href={href}
          className="block border-t border-hairline px-4 py-2.5 text-center text-[0.82rem] text-secondary transition-colors hover:bg-sunken hover:text-primary"
        >
          כל {checks.length} הצ׳קים ←
        </Link>
      ) : null}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) {
  const color = tone ? `var(--${tone})` : undefined;
  return (
    <div className="px-3 py-2.5">
      <div className="truncate text-[0.68rem] text-muted">{label}</div>
      <div className="mt-0.5 text-[1.05rem] font-semibold leading-none" style={color ? { color } : undefined}>
        {value} <span className="text-[0.72rem] font-normal text-muted">₪</span>
      </div>
    </div>
  );
}

function ils(v: string): string {
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Number(v))} ₪`;
}

function date(v: Date | string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Jerusalem',
  }).format(new Date(v));
}
