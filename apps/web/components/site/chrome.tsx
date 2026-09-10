import Link from 'next/link';

/** מסגרת חלון אחידה לכל הדגמות המוצר בעמוד. */
export function AppWindow({
  path,
  children,
  className = '',
}: {
  path: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-hairline bg-raised shadow-[0_1px_2px_rgba(11,19,26,0.04),0_12px_32px_-16px_rgba(11,19,26,0.18)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-hairline bg-sunken px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-strong" />
          <span className="size-2.5 rounded-full bg-strong" />
          <span className="size-2.5 rounded-full bg-strong" />
        </div>
        <span className="text-xs text-muted">{path}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * תג מצב. **תמיד** נושא תווית ולעולם לא צבע לבדו —
 * ההפרדה בין הנחושת לאדום בערכה הכהה מגיעה ל-ΔE 12.5, מתחת לסף
 * שבו צבע לבדו מספיק. התווית היא ערוץ הזיהוי, הצבע הוא חיזוק.
 */
export function StatusPill({
  tone,
  children,
}: {
  tone: 'positive' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
}) {
  const map = {
    positive: { bg: 'var(--positive-quiet)', fg: 'var(--positive)' },
    warning: { bg: 'var(--warning-quiet)', fg: 'var(--warning)' },
    danger: { bg: 'var(--danger-quiet)', fg: 'var(--danger)' },
    neutral: { bg: 'var(--surface-sunken)', fg: 'var(--text-secondary)' },
  }[tone];

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
      style={{ background: map.bg, color: map.fg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: map.fg }} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * אריח מדד. ערך בספרות פרופורציונליות (tabular-nums שמור לעמודות
 * שצריכות להתיישר, ובגודל תצוגה הוא נראה רופף).
 *
 * `href` הופך אותו לקישור — האריח כולו לחיץ, לא רק הערך. בלעדיו
 * מוצג בדיוק כמו קודם, לתאימות עם המסכים שכבר משתמשים בו כתצוגה
 * בלבד (כרטיס הדייר באדמין, למשל, שבו המספר לא מוביל לשום מקום).
 */
export function StatTile({
  label,
  value,
  note,
  spark,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  spark?: number[];
  href?: string;
}) {
  const content = (
    <>
      <div className="truncate text-[0.72rem] text-muted">{label}</div>
      <div className="mt-1 text-[1.55rem] font-semibold leading-none">{value}</div>
      {spark ? <Sparkline points={spark} /> : null}
      {note ? <div className="mt-1.5 text-[0.72rem] text-secondary">{note}</div> : null}
    </>
  );

  if (!href) {
    return <div className="min-w-0 border-hairline px-4 py-3.5">{content}</div>;
  }

  return (
    <Link
      href={href}
      className="block min-w-0 border-hairline px-4 py-3.5 transition-colors hover:bg-sunken"
    >
      {content}
    </Link>
  );
}

/** קו מגמה של 12 נקודות. הנקודה הנוכחית בנחושת, השאר עמומות. */
function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const w = 72;
  const h = 18;
  const step = w / (points.length - 1);
  const xy = points.map((p, i) => [i * step, h - ((p - min) / span) * h] as const);
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1]!;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-2 overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--accent)" stroke="var(--surface-raised)" strokeWidth="2" />
    </svg>
  );
}
