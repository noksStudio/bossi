import { AppWindow, StatusPill } from './chrome';

/**
 * ההדגמה של ההירו: כרטיס לקוח אחד שמראה **הכול במקום אחד** —
 * אנשי קשר עם תפקידים, מסמכים, ציר זמן ומצב. התחושה שצריכה לעבור
 * היא "הכל כאן ומסודר", לא "יש לך בעיה".
 */
export function CustomerCard() {
  return (
    <AppWindow path="לקוחות · דני כהן — סטודיו">
      <div className="flex items-start gap-3.5 border-b border-hairline px-5 py-4">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-md text-sm font-semibold"
          style={{ background: 'var(--accent-quiet)', color: 'var(--accent)' }}
        >
          דכ
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">דני כהן — סטודיו</span>
            <StatusPill tone="positive">פעיל</StatusPill>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            ד. כהן עיצוב בע״מ · ח״פ 515993027 · לקוח מאז 3/2023
          </div>
        </div>
      </div>

      {/* שלושה אנשי קשר, שלושה תפקידים — בעסק אמיתי זה כמעט תמיד לא אותו אדם */}
      <section className="border-b border-hairline px-5 py-4">
        <h3 className="mb-2.5 text-[0.78rem] text-muted">אנשי קשר</h3>
        <ul className="space-y-2">
          {[
            { n: 'דני כהן', r: 'מאשר', c: '052-555-1234' },
            { n: 'שירה אלון', r: 'מזמינה', c: 'shira@cohen-studio.co.il' },
            { n: 'הנהלת חשבונות', r: 'משלם', c: 'ap@cohen-studio.co.il' },
          ].map((p) => (
            <li key={p.n} className="flex items-center gap-2.5 text-[0.85rem]">
              <span className="w-24 shrink-0 truncate font-medium">{p.n}</span>
              <span
                className="shrink-0 rounded-sm px-1.5 py-0.5 text-[0.68rem]"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
              >
                {p.r}
              </span>
              <span className="truncate text-xs text-muted" dir="ltr">
                {p.c}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b border-hairline px-5 py-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h3 className="text-[0.78rem] text-muted">מסמכים</h3>
          <span className="text-[0.72rem] text-muted">34 סה״כ</span>
        </div>
        <ul className="space-y-2">
          {[
            { t: 'חוזה שירותים חתום', d: 'PDF · 12.3.2024', pill: null },
            { t: 'אישור ניכוי מס במקור', d: 'PDF · בתוקף עד 31.12', pill: 'פג בעוד 21 יום' },
            { t: 'תעודת משלוח 4471', d: 'סריקה · לפני 6 ימים', pill: null },
          ].map((f) => (
            <li key={f.t} className="flex items-center gap-2.5">
              <DocIcon />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.85rem]">{f.t}</div>
                <div className="text-[0.72rem] text-muted">{f.d}</div>
              </div>
              {f.pill ? <StatusPill tone="warning">{f.pill}</StatusPill> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="px-5 py-4">
        <h3 className="mb-3 text-[0.78rem] text-muted">ציר הזמן</h3>
        <ol className="space-y-3">
          {[
            { t: 'מייל עם הצעת מחיר מעודכנת — תויק אוטומטית', d: 'לפני 2 ימים' },
            { t: 'שיחה סוכמה: הרחבת הליווי לרבעון הבא', d: 'לפני 9 ימים' },
            { t: 'תעודת משלוח נחתמה ותויקה', d: 'לפני 6 שבועות' },
            { t: 'חוזה שירותים נחתם · הודעה מוקדמת 60 יום', d: '12.3.2024' },
          ].map((e) => (
            <li key={e.t} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-strong" />
              <div className="min-w-0 flex-1">
                <div className="text-[0.85rem] leading-snug">{e.t}</div>
                <div className="text-[0.72rem] text-muted">{e.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </AppWindow>
  );
}

function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
      <path
        d="M4 1.75h4.6L12.25 5.4v8.85a.9.9 0 0 1-.9.9H4a.9.9 0 0 1-.9-.9V2.65a.9.9 0 0 1 .9-.9Z"
        stroke="var(--text-muted)"
        strokeWidth="1.3"
      />
      <path d="M8.4 2v3.6h3.6" stroke="var(--text-muted)" strokeWidth="1.3" />
    </svg>
  );
}
