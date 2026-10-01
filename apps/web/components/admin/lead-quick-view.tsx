'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProspectNoteRow, ProspectRow } from '@bossi/db';
import { StatusPill } from '@/components/site/chrome';
import { telHref } from '@/lib/phone';
import { CallGuide } from '@/components/admin/call-guide';
import { useScrollLock } from '@/lib/use-scroll-lock';

/**
 * לחיצה על שורת ליד פותחת תצוגה מהירה (מודאל, גיליון בנייד) — לא
 * עמוד. רק לחיצה על השם *בתוך* התצוגה המהירה פותחת את הכרטיס המלא
 * (`/admin/leads/[id]`).
 *
 * הפופ-אפ עצמו לא משתמש ב-server actions עם redirect: זה היה סוגר
 * אותו בכל קליק. במקום זה — `/api/admin/leads/[id]` — GET לטעינה,
 * PATCH לשמירה אטומית של שדה בודד (בלי כפתור "שמירה"), DELETE להסרה.
 * `router.refresh()` אחרי כל שינוי מרענן את הרשימה מתחת בלי לסגור
 * את הפופ-אפ (זה לא remount — הקומפוננטה נשארת, רק ה-props מתעדכנים).
 */
export function LeadList({
  prospects, sourceLabels,
}: {
  prospects: ProspectRow[];
  sourceLabels: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
        {prospects.map((p) => (
          <li key={p.id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="flex min-w-0 flex-1 items-start justify-between gap-3 p-3.5 text-start transition-colors hover:bg-sunken"
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
            {p.phone ? (
              <a
                href={telHref(p.phone)}
                aria-label={`חיוג ל${p.name}`}
                className="flex shrink-0 items-center border-s border-hairline px-4 text-[0.8rem] font-medium transition-colors hover:bg-sunken"
                style={{ color: 'var(--accent)' }}
              >
                חיוג
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {selectedId ? (
        <LeadPopup id={selectedId} sourceLabels={sourceLabels} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}

// ── שדה עם שמירה אטומית ─────────────────────────────────────────────────

function AutoSaveField({
  id, field, label, value, dir, multiline, onSaved,
}: {
  id: string; field: string; label: string; value: string; dir?: 'ltr' | 'rtl'; multiline?: boolean;
  /** מרים את הערך שנשמר בחזרה ל-state של ההורה — כדי שתצוגה נגזרת (כמו קישור המפות) תתעדכן בלי לחכות לרענון הפופ-אפ. */
  onSaved?: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(value);
  useEffect(() => { setDraft(value); lastSaved.current = value; }, [value]);

  async function save() {
    if (draft === lastSaved.current) return;
    const previous = lastSaved.current;
    lastSaved.current = draft;
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value: draft }),
    });
    if (!res.ok) {
      // הערך לא נשמר (למשל טלפון של ליד אחר) — חוזרים לערך השמור ולא משאירים מצג שווא.
      const body = await res.json().catch(() => ({}));
      lastSaved.current = previous;
      setDraft(previous);
      setError(typeof body?.message === 'string' ? body.message : 'השמירה נכשלה');
      return;
    }
    setError(null);
    onSaved?.(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  const Comp = multiline ? 'textarea' : 'input';
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[0.7rem] text-muted">
        {label}
        <span style={{ opacity: saved ? 1 : 0, color: 'var(--positive)', transition: 'opacity 0.2s' }}>✓ נשמר</span>
      </span>
      <Comp
        value={draft}
        dir={dir}
        rows={multiline ? 3 : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (!multiline && e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2.5 py-1.5 text-[0.86rem] outline-none focus:border-accent"
      />
      {error ? <span className="mt-1 block text-[0.72rem]" style={{ color: 'var(--danger)' }}>{error}</span> : null}
    </label>
  );
}

// ── הפופ-אפ עצמו ─────────────────────────────────────────────────────────

function LeadPopup({
  id, sourceLabels, onClose,
}: {
  id: string; sourceLabels: Record<string, string>; onClose: () => void;
}) {
  const router = useRouter();
  const [prospect, setProspect] = useState<ProspectRow | null>(null);
  const [notes, setNotes] = useState<ProspectNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftNote, setDraftNote] = useState('');
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useScrollLock();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/leads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProspect(data.prospect);
        setNotes(data.notes ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  /** מעדכן שדה טקסט מקומי מיד אחרי שמירה אטומית — בלי זה, תצוגה נגזרת כמו קישור המפות נשארת עם הערך הישן עד סגירה ופתיחה מחדש של הפופ-אפ. */
  function setField(field: keyof ProspectRow, value: string) {
    setProspect((p) => p ? { ...p, [field]: value } : p);
  }

  async function toggle(field: 'contacted' | 'booked', value: boolean) {
    setProspect((p) => p ? { ...p, [field === 'contacted' ? 'contacted' : 'booked_at']: field === 'contacted' ? value : (value ? new Date() : null) } : p);
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value }),
    });
    const data = await res.json();
    if (data.prospect) setProspect(data.prospect);
    router.refresh();
  }

  async function saveFollowUp(value: string) {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'followUp', value }),
    });
    const data = await res.json();
    if (data.prospect) setProspect(data.prospect);
    router.refresh();
  }

  async function sendNote() {
    const text = draftNote.trim();
    if (!text) return;
    setSending(true);
    const res = await fetch(`/api/admin/leads/${id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }),
    });
    const data = await res.json();
    if (data.notes) setNotes(data.notes);
    setDraftNote('');
    setSending(false);
  }

  async function remove() {
    if (!window.confirm(`למחוק את "${prospect?.name ?? 'הליד'}"? אי אפשר לבטל.`)) return;
    await fetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-hairline bg-raised shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={prospect?.name ?? 'ליד'}
      >
        {loading || !prospect ? (
          <div className="flex items-center justify-between p-4">
            <span className="text-[0.88rem] text-muted">טוען…</span>
            <button type="button" onClick={onClose} aria-label="סגירה" className="-m-2 p-2 text-[1rem] text-muted hover:text-primary">✕</button>
          </div>
        ) : (
          <>
            {/* כותרת קבועה — לא נגללת, כך שהסגירה תמיד בהישג יד */}
            <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/leads/${id}`} className="block truncate text-[1.05rem] font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                  {prospect.name}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {prospect.booked_at ? <StatusPill tone="positive">שיחה נקבעה</StatusPill>
                    : prospect.contacted ? <StatusPill tone="neutral">נוצר קשר</StatusPill>
                      : <StatusPill tone="warning">טרם נוצר קשר</StatusPill>}
                  <span className="text-[0.72rem] text-muted">{sourceLabels[prospect.source] ?? prospect.source}</span>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="סגירה" className="-m-2 shrink-0 p-2 text-[1.05rem] text-muted hover:text-primary">✕</button>
            </header>

            {/* גוף: בנייד עמודה אחת שנגללת כולה, בדסקטופ שתי עמודות שנגללות בנפרד */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:flex sm:overflow-hidden sm:pb-0">
              <aside className="flex flex-col gap-3.5 border-b border-hairline bg-sunken p-4 sm:w-72 sm:shrink-0 sm:overflow-y-auto sm:overscroll-contain sm:border-b-0 sm:border-s">
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => setCalling(true)}
                    className="flex-1 rounded-md py-2.5 text-[0.92rem] font-medium text-white" style={{ background: 'var(--accent)' }}
                  >
                    שיחה מודרכת
                  </button>
                  {prospect.phone ? (
                    <a href={telHref(prospect.phone)} className="flex items-center rounded-md border border-strong bg-raised px-4 text-[0.92rem] font-medium" style={{ color: 'var(--accent)' }}>
                      חיוג
                    </a>
                  ) : null}
                </div>

                {prospect.phone || prospect.address ? (
                  <div className="space-y-0.5 text-[0.85rem]">
                    {prospect.phone ? <div dir="ltr" className="text-end text-secondary">{prospect.phone}</div> : null}
                    {prospect.address ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospect.address)}`}
                        target="_blank" rel="noreferrer" className="block text-secondary hover:underline"
                      >
                        {prospect.address} <span style={{ color: 'var(--accent)' }}>· מפות</span>
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button" onClick={() => toggle('contacted', !prospect.contacted)}
                    className="rounded-md border border-strong bg-raised px-2 py-2 text-[0.82rem]"
                    style={{ color: prospect.contacted ? 'var(--positive)' : undefined }}
                  >
                    {prospect.contacted ? '✓ נוצר קשר' : 'סמן שנוצר קשר'}
                  </button>
                  <button
                    type="button" onClick={() => toggle('booked', !prospect.booked_at)}
                    className="rounded-md border border-strong bg-raised px-2 py-2 text-[0.82rem] font-medium"
                    style={{ color: prospect.booked_at ? 'var(--positive)' : 'var(--accent)' }}
                  >
                    {prospect.booked_at ? '✓ שיחה נקבעה' : 'קבע שיחה'}
                  </button>
                </div>

                <label className="block min-w-0">
                  <span className="text-[0.75rem] text-muted">פולואפ — מתי לחזור</span>
                  <input
                    key={prospect.next_follow_up_at ? String(prospect.next_follow_up_at) : 'none'}
                    type="datetime-local"
                    defaultValue={toLocalInputValue(prospect.next_follow_up_at)}
                    onBlur={(e) => saveFollowUp(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.88rem] outline-none focus:border-accent"
                  />
                </label>

                <details className="rounded-lg border border-hairline bg-raised">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[0.85rem] font-medium [&::-webkit-details-marker]:hidden">
                    פרטי העסק
                    <span className="text-[0.75rem] font-normal text-muted">עריכה</span>
                  </summary>
                  <div className="space-y-3 border-t border-hairline p-3">
                    <AutoSaveField id={id} field="phone" label="טלפון" value={prospect.phone ?? ''} dir="ltr" onSaved={(v) => setField('phone', v)} />
                    <AutoSaveField id={id} field="address" label="מיקום" value={prospect.address ?? ''} onSaved={(v) => setField('address', v)} />
                    <AutoSaveField id={id} field="website" label="אתר" value={prospect.website ?? ''} dir="ltr" onSaved={(v) => setField('website', v)} />
                    <AutoSaveField id={id} field="national_id" label='ת"ז בעל העסק' value={prospect.national_id ?? ''} dir="ltr" onSaved={(v) => setField('national_id', v)} />
                    <AutoSaveField id={id} field="company_number" label='ח"פ' value={prospect.company_number ?? ''} dir="ltr" onSaved={(v) => setField('company_number', v)} />
                    <AutoSaveField id={id} field="note" label="תיאור" value={prospect.note ?? ''} multiline onSaved={(v) => setField('note', v)} />
                    <button type="button" onClick={remove} className="pt-1 text-[0.8rem]" style={{ color: 'var(--danger)' }}>
                      מחיקת הליד
                    </button>
                  </div>
                </details>
              </aside>

              {/* מה היה בשיחות */}
              <section className="flex min-w-0 flex-1 flex-col sm:overflow-hidden">
                <div className="border-b border-hairline p-4">
                  <textarea
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendNote(); }}
                    placeholder="מה קרה עכשיו?"
                    rows={2}
                    className="w-full resize-none rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none focus:border-accent"
                  />
                  <button
                    type="button" onClick={sendNote} disabled={sending || !draftNote.trim()}
                    className="mt-2 rounded-md px-4 py-2 text-[0.85rem] font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--accent)' }}
                  >
                    {sending ? 'שולח…' : 'הוספת רשומה'}
                  </button>
                </div>

                <div className="flex-1 space-y-2.5 p-4 sm:overflow-y-auto sm:overscroll-contain">
                  {notes.length === 0 ? (
                    <p className="text-[0.85rem] text-muted">עוד אין תיעוד שיחות.</p>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-hairline p-3 text-[0.86rem]">
                        <div className="text-[0.72rem] text-muted">{formatDateTime(n.created_at)}</div>
                        <div className="mt-1 whitespace-pre-wrap text-secondary">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
      {calling && prospect ? (
        <CallGuide
          leadId={id} leadName={prospect.name} phone={prospect.phone}
          onClose={() => setCalling(false)}
          onSaved={() => { setReloadKey((k) => k + 1); router.refresh(); }}
        />
      ) : null}
    </div>
  );
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

function toLocalInputValue(d: Date | string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
