import { AppWindow, StatTile, StatusPill } from './chrome';

/**
 * הדשבורד — הסעיף שמראה את ההבטחה השלישית: **סדר**.
 *
 * מדדים הם אריחים ולא גרפים: כמה מספרי כותרת הם שורת אריחים, לא
 * תרשים עמודות מקובץ. הגרף היחיד הוא קו מגמה זעיר בתוך אריח.
 */
export function DashboardPreview() {
  return (
    <AppWindow path="לוח הבקרה">
      <div className="border-b border-hairline px-5 py-4">
        <h3 className="text-[1.05rem]">בוקר טוב, נעה</h3>
        <p className="mt-0.5 text-[0.8rem] text-muted">יום ראשון, 6 בספטמבר · 3 דברים דורשים אותך</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline border-b border-hairline sm:grid-cols-4">
        <StatTile label="לקוחות פעילים" value="47" note="+3 החודש" />
        <StatTile label="מסמכים החודש" value="312" spark={[180, 210, 195, 240, 228, 265, 250, 288, 275, 301, 294, 312]} />
        <StatTile label="ממתין לאישור" value="6" note="2 דקות לסגור" />
        <StatTile label="לא נגעת בהם" value="9" note="מעל 60 יום" />
      </div>

      {/* כל שורה נושאת פעולה. התראה בלי כפתור היא רעש. */}
      <section className="border-b border-hairline px-5 py-4">
        <h4 className="mb-3 text-[0.78rem] text-muted">דורש תשומת לב</h4>
        <ul className="space-y-3">
          {[
            {
              t: 'אישור ניכוי מס של דני כהן פג בעוד 21 יום',
              s: 'תשלום מתוכנן ב־5.10',
              tone: 'warning' as const,
              pill: 'תוקף',
              action: 'בקש חדש',
            },
            {
              t: 'רונית ברק — 9 ימי איחור, והיא תמיד משלמת בזמן',
              s: 'חריגה מהדפוס שלה',
              tone: 'danger' as const,
              pill: 'באיחור',
              action: 'שלח תזכורת',
            },
            {
              t: 'הריטיינר של מעבדות תבל מתחדש בעוד 24 יום',
              s: 'המחיר לא עודכן 22 חודשים',
              tone: 'warning' as const,
              pill: 'חידוש',
              action: 'הכן הצעה',
            },
          ].map((r) => (
            <li key={r.t} className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <StatusPill tone={r.tone}>{r.pill}</StatusPill>
              <div className="min-w-0 flex-1">
                <div className="text-[0.85rem] leading-snug">{r.t}</div>
                <div className="text-[0.72rem] text-muted">{r.s}</div>
              </div>
              <button className="shrink-0 rounded-sm border border-strong px-2 py-1 text-[0.72rem] text-secondary">
                {r.action}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* סיפור הריכוז, ויזואלית: הכל נכנס לבד ונוחת על הלקוח הנכון */}
      <section className="px-5 py-4">
        <h4 className="mb-3 text-[0.78rem] text-muted">נכנס היום · תויק לבד</h4>
        <ul className="space-y-2.5">
          {[
            { t: 'חשבונית ספק — חשמל תעשייתי', v: 'מייל', c: 'מעבדות תבל' },
            { t: 'הצעת מחיר חתומה', v: 'WhatsApp', c: 'דני כהן — סטודיו' },
            { t: 'תעודת משלוח 4482', v: 'סריקה', c: 'מוסך הצפון' },
            { t: 'אישור ניכוי מס 2026', v: 'מייל', c: 'רונית ברק' },
          ].map((d) => (
            <li key={d.t} className="flex items-center gap-2.5 text-[0.82rem]">
              <span
                className="w-16 shrink-0 rounded-sm px-1.5 py-0.5 text-center text-[0.66rem]"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}
              >
                {d.v}
              </span>
              <span className="min-w-0 flex-1 truncate">{d.t}</span>
              <span className="shrink-0 text-[0.72rem] text-muted">← {d.c}</span>
            </li>
          ))}
        </ul>
      </section>
    </AppWindow>
  );
}
