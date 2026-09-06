/**
 * חלון מוצר אמיתי בתוך העמוד — לא צילום מסך ולא איור.
 * מראה בדיוק את הרגע שהמערכת קיימת בשבילו: ריטיינר שנשרף מהר מדי,
 * וחוב שחורג מהדפוס הרגיל של הלקוח.
 */
export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-raised shadow-[0_1px_2px_rgba(11,19,26,0.04),0_12px_32px_-16px_rgba(11,19,26,0.18)]">
      <div className="flex items-center gap-3 border-b border-hairline bg-sunken px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-strong" />
          <span className="size-2.5 rounded-full bg-strong" />
          <span className="size-2.5 rounded-full bg-strong" />
        </div>
        <span className="text-xs text-muted">לקוחות · דני כהן — סטודיו</span>
      </div>

      <div className="divide-y divide-hairline">
        <div className="flex items-center gap-3.5 px-5 py-4">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-md text-sm font-semibold"
            style={{ background: 'var(--accent-quiet)', color: 'var(--accent)' }}
          >
            דכ
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">דני כהן — סטודיו</div>
            <div className="text-xs text-muted">לקוח מאז 3/2023 · ריטיינר חודשי</div>
          </div>
          <div className="text-end">
            <div className="tnum text-sm font-semibold">12,400 ₪</div>
            <div className="text-xs" style={{ color: 'var(--danger)' }}>באיחור 45 יום</div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[0.82rem] text-secondary">ניצול הריטיינר · ספטמבר</span>
            <span className="tnum text-[0.82rem] font-semibold" style={{ color: 'var(--warning)' }}>78%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full" style={{ width: '78%', background: 'var(--warning)' }} />
          </div>
          <p className="mt-2.5 text-[0.82rem] text-secondary">
            עברו 15 מתוך 30 יום. בקצב הזה יסיים ב־<span className="tnum font-semibold">156%</span>
            {' '}— חריגה צפויה של <span className="tnum font-semibold">1,960 ₪</span>.
          </p>
        </div>

        <div className="px-5 py-4" style={{ background: 'var(--danger-quiet)' }}>
          <div className="flex items-start gap-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: 'var(--danger)' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.88rem] leading-relaxed">
                דני משלם בממוצע <span className="tnum font-semibold">14 יום</span> באיחור. הפעם 45 —
                זו חריגה מהדפוס שלו.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="rounded-sm px-2.5 py-1 text-xs font-medium text-white" style={{ background: 'var(--accent)' }}>
                  תזכורת + צירוף החוזה
                </span>
                <span className="rounded-sm border border-strong px-2.5 py-1 text-xs text-secondary">
                  דחה ל־7 ימים
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 text-[0.82rem] text-muted">ציר הזמן</div>
          <ol className="space-y-3">
            {[
              { t: 'חשבונית 2024-118 עברה את מועד הפירעון', d: 'לפני 45 יום', tone: 'danger' },
              { t: 'תעודת משלוח נחתמה ותויקה אוטומטית', d: 'לפני 61 יום', tone: 'muted' },
              { t: 'חוזה שירותים נחתם · הודעה מוקדמת 60 יום', d: '12.3.2024', tone: 'muted' },
            ].map((e) => (
              <li key={e.t} className="flex gap-3">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: e.tone === 'danger' ? 'var(--danger)' : 'var(--border-strong)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[0.85rem] leading-snug">{e.t}</div>
                  <div className="text-xs text-muted">{e.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
