'use client';

import { useState } from 'react';

/**
 * שינוי שלב. 'won' לא מופיע באפשרויות בכוונה — הדרך היחידה לשם היא
 * "המר ללקוח" (כפתור נפרד בעמוד), כדי שלא יהיה מצב "נסגר בהצלחה"
 * בלי לקוח אמיתי מאחוריו (ראו convertLead, packages/db).
 */
export function LeadStageForm({
  currentStage, options, onSubmit,
}: {
  currentStage: string;
  options: Array<{ value: string; label: string }>;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [stage, setStage] = useState(currentStage);

  return (
    <form action={onSubmit} className="space-y-2.5">
      <select
        name="stage"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className="w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {stage === 'lost' ? (
        <textarea
          name="lostReason"
          rows={2}
          placeholder="למה? (יעזור בעוד חודש)"
          className="w-full resize-y rounded-md border border-strong bg-raised px-3 py-2 text-[0.85rem] outline-none"
        />
      ) : null}
      <button type="submit" className="rounded-md border border-strong px-3.5 py-1.5 text-[0.85rem]">
        עדכן שלב
      </button>
    </form>
  );
}
