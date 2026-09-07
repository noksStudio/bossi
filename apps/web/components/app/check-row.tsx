'use client';

import { useState, useTransition } from 'react';
import type { CheckRow } from '@bossi/db';
import type { DisplayStatus } from '@bossi/core';

const TONE: Record<DisplayStatus, { bg: string; fg: string; label: string }> = {
  overdue:   { bg: 'var(--danger-quiet)',   fg: 'var(--danger)',   label: 'עבר מועד' },
  due_today: { bg: 'var(--warning-quiet)',  fg: 'var(--warning)',  label: 'היום' },
  upcoming:  { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'עתידי' },
  pending:   { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'ממתין' },
  cleared:   { bg: 'var(--positive-quiet)', fg: 'var(--positive)', label: 'נפרע' },
  partial:   { bg: 'var(--warning-quiet)',  fg: 'var(--warning)',  label: 'חלקי' },
  bounced:   { bg: 'var(--danger-quiet)',   fg: 'var(--danger)',   label: 'חזר' },
  void:      { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'בוטל' },
};

/**
 * שורת צ'ק במסך ההתאמה.
 *
 * העיקרון: **פעולה אחת בלחיצה אחת.** ראובן פותח את דף הבנק לצד המסך
 * ועובר 35 שורות — כל קליק נוסף הוא 35 קליקים נוספים. לכן "נפרע" הוא
 * כפתור יחיד, ורק "חלקי" נפתח לשדה סכום.
 */
export function CheckRowItem({
  check,
  status,
  canMark,
  onMark,
}: {
  check: CheckRow;
  status: DisplayStatus;
  canMark: boolean;
  onMark: (id: string, formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [partialOpen, setPartialOpen] = useState(false);
  const tone = TONE[status];
  const marked = ['cleared', 'partial', 'bounced', 'void'].includes(check.status);

  const mark = (status: string, amount?: string) => {
    const data = new FormData();
    data.set('status', status);
    if (amount) data.set('clearedAmount', amount);
    startTransition(async () => {
      await onMark(check.id, data);
      setPartialOpen(false);
    });
  };

  return (
    <li className={`px-4 py-2.5 transition-opacity ${pending ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="w-[4.5rem] shrink-0 rounded-full px-2 py-0.5 text-center text-[0.68rem] font-medium"
          style={{ background: tone.bg, color: tone.fg }}
        >
          {tone.label}
        </span>

        <span className="tnum w-14 shrink-0 text-[0.8rem] text-muted">{shortDate(check.due_on)}</span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.9rem]">{check.customer_name}</div>
          <div className="flex flex-wrap gap-x-2 text-[0.7rem] text-muted">
            {check.property_name ? <span>{check.property_name}</span> : null}
            {check.check_number ? <span dir="ltr">צ׳ק {check.check_number}</span> : null}
            {check.bank_name ? <span>{check.bank_name}</span> : null}
          </div>
        </div>

        <div className="shrink-0 text-end">
          <div className="tnum text-[0.92rem] font-semibold">{ils(check.amount)}</div>
          {check.status === 'partial' && check.cleared_amount ? (
            <div className="tnum text-[0.7rem]" style={{ color: 'var(--warning)' }}>
              נכנס {ils(check.cleared_amount)} · חסר {ils(String(Number(check.amount) - Number(check.cleared_amount)))}
            </div>
          ) : null}
        </div>

        {canMark ? (
          <div className="flex shrink-0 gap-1.5">
            {marked ? (
              <>
                <span className="text-[0.7rem] text-muted">
                  {check.cleared_by_name ? `סומן ע״י ${check.cleared_by_name}` : 'סומן'}
                </span>
                <button
                  type="button"
                  onClick={() => mark('pending')}
                  className="rounded-sm border border-hairline px-2 py-1 text-[0.7rem] text-muted"
                >
                  בטל סימון
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => mark('cleared')}
                  className="rounded-sm px-2.5 py-1 text-[0.75rem] font-medium text-white"
                  style={{ background: 'var(--positive)' }}
                >
                  ✓ נפרע
                </button>
                <button
                  type="button"
                  onClick={() => setPartialOpen((v) => !v)}
                  className="rounded-sm border border-strong px-2 py-1 text-[0.72rem] text-secondary"
                >
                  חלקי
                </button>
                <button
                  type="button"
                  onClick={() => mark('bounced')}
                  className="rounded-sm border border-strong px-2 py-1 text-[0.72rem]"
                  style={{ color: 'var(--danger)' }}
                >
                  חזר
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {partialOpen ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-sunken px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = new FormData(e.currentTarget).get('amount');
            if (amount) mark('partial', String(amount));
          }}
        >
          <label className="text-[0.78rem] text-secondary">כמה נכנס בפועל?</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            max={Number(check.amount) - 0.01}
            required
            autoFocus
            dir="ltr"
            placeholder={String(Math.round(Number(check.amount) * 0.9))}
            className="tnum w-28 rounded-sm border border-strong bg-raised px-2 py-1 text-[0.85rem] outline-none"
          />
          <button type="submit" className="rounded-sm px-2.5 py-1 text-[0.75rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
            שמור
          </button>
          <span className="text-[0.72rem] text-muted">ההפרש יישאר כיתרה פתוחה</span>
        </form>
      ) : null}
    </li>
  );
}

function shortDate(d: Date | string): string {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Jerusalem' }).format(new Date(d));
}

function ils(amount: string): string {
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Number(amount))} ₪`;
}
