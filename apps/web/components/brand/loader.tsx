/**
 * מערכת הטעינה, בשלוש שכבות:
 *   1. `RouteProgress` — פס דק בראש העמוד למעבר בין מסכים
 *   2. `Skeleton` — שלד בצורת התוכן האמיתי, לטעינת נתונים
 *   3. `BossiLoader` — הסימן שנבנה שורה-שורה, לטעינה ראשונה בלבד
 *
 * הכלל: אף פעם ספינר גנרי מסתובב. טעינה צריכה לרמוז מה עומד להופיע.
 */

export function BossiLoader({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20" role="status">
      <svg width="52" height="52" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect
          x="1.25" y="1.25" width="29.5" height="29.5" rx="7.5"
          stroke="var(--border-strong)" strokeWidth="2.5"
        />
        {[
          { y: 9, w: 16, delay: '0s', fill: 'var(--text-muted)' },
          { y: 14.6, w: 16, delay: '0.18s', fill: 'var(--accent)' },
          { y: 20.2, w: 10, delay: '0.36s', fill: 'var(--text-muted)' },
        ].map((bar) => (
          <rect
            key={bar.y}
            x="8" y={bar.y} width={bar.w} height="2.75" rx="1.375"
            fill={bar.fill}
            style={{ animation: `bossi-fill 1.35s ${bar.delay} var(--ease-out-soft) infinite`, transformOrigin: 'right center' }}
          />
        ))}
      </svg>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <style>{`
        @keyframes bossi-fill {
          0%, 100% { transform: scaleX(0.15); opacity: 0.35; }
          35%, 65% { transform: scaleX(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/** פס התקדמות עדין לראש העמוד. אינדטרמיניסטי — לא מזייף אחוזים. */
export function RouteProgress() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      role="progressbar"
      aria-label="טוען עמוד"
    >
      <div
        className="h-full w-1/3"
        style={{
          background: 'linear-gradient(to left, transparent, var(--accent), transparent)',
          animation: 'bossi-sweep 1.1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes bossi-sweep {
          0%   { transform: translateX(120%); }
          100% { transform: translateX(-320%); }
        }
      `}</style>
    </div>
  );
}

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-sm ${className}`}
      style={{
        background:
          'linear-gradient(90deg, var(--surface-sunken) 25%, var(--border-hairline) 37%, var(--surface-sunken) 63%)',
        backgroundSize: '400% 100%',
        animation: 'bossi-shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    >
      <style>{`
        @keyframes bossi-shimmer {
          0%   { background-position: 0% 0; }
          100% { background-position: -135% 0; }
        }
      `}</style>
    </div>
  );
}

/** שלד בצורת שורת לקוח — כך שהמעבר לתוכן האמיתי כמעט לא מורגש. */
export function CustomerRowSkeleton() {
  return (
    <div
      className="flex items-center gap-4 border-b px-5 py-4"
      style={{ borderColor: 'var(--border-hairline)' }}
    >
      <Skeleton className="size-9 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}
