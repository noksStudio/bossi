import { AppWindow } from './chrome';

/**
 * ההבטחה השנייה: **שליפה**. לא רשימת קבצים — תשובה עם ציטוט.
 * בלי עוגן אין ציטוט, בלי ציטוט אין אמון, ובלי אמון אף אחד
 * לא יסמוך על זה בוויכוח מול לקוח.
 */
export function SearchPreview() {
  return (
    <AppWindow path="חיפוש">
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-2.5 rounded-md border border-strong bg-sunken px-3 py-2.5">
          <SearchIcon />
          <span className="text-[0.9rem]">מה סיכמנו עם דני על ביטול?</span>
          <span className="h-4 w-px animate-pulse bg-accent" aria-hidden="true" />
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-[0.95rem] leading-relaxed">
          הודעה מוקדמת בכתב של <strong className="font-semibold">60 יום</strong>, ללא קנס יציאה.
        </p>

        <figure
          className="mt-3.5 rounded-md border-s-2 bg-sunken px-3.5 py-3"
          style={{ borderInlineStartColor: 'var(--accent)' }}
        >
          <blockquote className="text-[0.85rem] leading-relaxed text-secondary">
            ״כל צד רשאי להביא הסכם זה לידי סיום בהודעה מוקדמת בכתב של 60 יום, מבלי שתחול
            על הצד המסיים חבות כלשהי…״
          </blockquote>
          <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted">
            <span>חוזה שירותים — דני כהן</span>
            <span aria-hidden="true">·</span>
            <span>12.3.2024</span>
            <span aria-hidden="true">·</span>
            <span>עמ׳ 4, סעיף 8.2</span>
            <span className="ms-auto font-medium" style={{ color: 'var(--accent)' }}>
              פתח במסמך ←
            </span>
          </figcaption>
        </figure>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {['גם ב־2 חוזים נוספים', 'סעיפי ביטול', 'כל המסמכים של דני'].map((c) => (
            <span
              key={c}
              className="rounded-full border border-hairline px-2.5 py-1 text-[0.72rem] text-secondary"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
      <circle cx="7.2" cy="7.2" r="4.4" stroke="var(--text-muted)" strokeWidth="1.5" />
      <path d="m10.6 10.6 3 3" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
