'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProspectRow } from '@bossi/db';
import { StatusPill } from '@/components/site/chrome';

/**
 * לחיצה על שורת ליד פותחת תצוגה מהירה (מודאל) — לא עמוד. רק לחיצה
 * על השם *בתוך* התצוגה המהירה פותחת את הכרטיס המלא (`/admin/leads/[id]`,
 * שם נמצא תיעוד השיחות והפולואפ). זה חוסך ניווט הלוך-חזור כשכל מה
 * שצריך זה לסמן "נוצר קשר" ולהמשיך הלאה ברשימה.
 */
export function LeadList({
  prospects, sourceLabels, toggleContacted, toggleBooked, removeProspect,
}: {
  prospects: ProspectRow[];
  sourceLabels: Record<string, string>;
  toggleContacted: (formData: FormData) => void | Promise<void>;
  toggleBooked: (formData: FormData) => void | Promise<void>;
  removeProspect: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<ProspectRow | null>(null);

  return (
    <>
      <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
        {prospects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setSelected(p)}
              className="flex w-full items-start justify-between gap-3 p-3.5 text-start transition-colors hover:bg-sunken"
            >
              <div className="min-w-0">
                <div className="text-[0.9rem] font-medium">{p.name}</div>
                <div className="text-[0.72rem] text-muted">{sourceLabels[p.source] ?? p.source}</div>
                {p.phone ? <div className="text-[0.78rem] text-muted" dir="ltr">{p.phone}</div> : null}
                {p.next_follow_up_at ? (
                  <div className="mt-1 text-[0.76rem] font-medium" style={{ color: new Date(p.next_follow_up_at) < new Date() ? 'var(--danger)' : 'var(--accent)' }}>
                    פולואפ: {new Date(p.next_follow_up_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0">
                {p.booked_at ? <StatusPill tone="positive">שיחה נקבעה</StatusPill>
                  : p.contacted ? <StatusPill tone="neutral">נוצר קשר</StatusPill>
                    : <StatusPill tone="warning">טרם נוצר קשר</StatusPill>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-hairline bg-raised p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/admin/leads/${selected.id}`}
                  className="text-[1.15rem] font-medium hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {selected.name}
                </Link>
                <div className="mt-0.5 text-[0.78rem] text-muted">{sourceLabels[selected.source] ?? selected.source}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[0.85rem] text-muted hover:text-primary">✕</button>
            </div>

            <div className="mt-3 space-y-1 text-[0.86rem]">
              {selected.phone ? <div dir="ltr" className="text-secondary">{selected.phone}</div> : null}
              {selected.address ? <div className="text-secondary">{selected.address}</div> : null}
              {selected.national_id ? <div dir="ltr" className="text-secondary">ת&quot;ז {selected.national_id}</div> : null}
              {selected.company_number ? <div dir="ltr" className="text-secondary">ח&quot;פ {selected.company_number}</div> : null}
              {selected.note ? <div className="mt-1 text-secondary">{selected.note}</div> : null}
              {selected.next_follow_up_at ? (
                <div className="font-medium" style={{ color: new Date(selected.next_follow_up_at) < new Date() ? 'var(--danger)' : 'var(--accent)' }}>
                  פולואפ: {new Date(selected.next_follow_up_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-hairline pt-4">
              <form action={toggleContacted}>
                <input type="hidden" name="id" value={selected.id} />
                <input type="hidden" name="contacted" value={selected.contacted ? '0' : '1'} />
                <button type="submit" className="rounded-md border border-strong px-3 py-1.5 text-[0.82rem]" style={{ color: selected.contacted ? 'var(--positive)' : undefined }}>
                  {selected.contacted ? '✓ נוצר קשר' : 'סמן שנוצר קשר'}
                </button>
              </form>
              <form action={toggleBooked}>
                <input type="hidden" name="id" value={selected.id} />
                <input type="hidden" name="booked" value={selected.booked_at ? '0' : '1'} />
                <button type="submit" className="rounded-md border border-strong px-3 py-1.5 text-[0.82rem] font-medium" style={{ color: selected.booked_at ? 'var(--positive)' : 'var(--accent)' }}>
                  {selected.booked_at ? '✓ שיחה נקבעה' : 'קבע שיחה'}
                </button>
              </form>
              <form action={removeProspect}>
                <input type="hidden" name="id" value={selected.id} />
                <button type="submit" className="rounded-md px-3 py-1.5 text-[0.82rem]" style={{ color: 'var(--danger)' }}>הסרה</button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
