'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CALL_SCRIPT, OUTCOME_LABELS, callSummary, type Outcome, type ScriptOption, type StepId,
} from '@/lib/call-script';
import { telHref } from '@/lib/phone';
import { useScrollLock } from '@/lib/use-scroll-lock';

const PLACES = ['במשרד שלו', 'בבית קפה', 'בזום'] as const;

/**
 * שיחה מודרכת על ליד: צעד אחרי צעד לפי מה שקורה בשיחה, ובסוף התוצאה
 * נרשמת על הליד דרך אותם endpoints של הכרטיס — הערה עם המסלול, פולואפ,
 * "נוצר קשר" / "נקבעה שיחה". אין כאן לוגיקה שלא קיימת כבר בכרטיס.
 */
export function CallGuide({
  leadId, leadName, phone, onClose, onSaved,
}: {
  leadId: string; leadName: string; phone: string | null; onClose: () => void; onSaved: () => void;
}) {
  const [stepId, setStepId] = useState<StepId>('start');
  const [history, setHistory] = useState<StepId[]>([]);
  const [path, setPath] = useState<ScriptOption[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState<string>(PLACES[0]);
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useScrollLock();

  const step = CALL_SCRIPT[stepId];

  function choose(option: ScriptOption) {
    setPath((p) => [...p, option]);
    if (option.outcome) {
      setOutcome(option.outcome);
      setWhen(option.outcome === 'no_answer' ? retryDefault() : option.outcome === 'callback' ? nextBusinessMorning() : '');
      return;
    }
    if (option.next) {
      setHistory((h) => [...h, stepId]);
      setStepId(option.next);
    }
  }

  function back() {
    if (outcome) {
      setOutcome(null);
      setPath((p) => p.slice(0, -1));
      return;
    }
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setPath((p) => p.slice(0, -1));
    setStepId(prev);
  }

  async function patch(field: string, value: unknown) {
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value }),
    });
    if (!res.ok) throw new Error('save failed');
  }

  async function save() {
    if (!outcome) return;
    if (outcome === 'meeting' && !when) {
      setError('צריך תאריך ושעה לפגישה');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const spoke = path.some((o) => o.next === 'secretary' || o.next === 'ownerOpen');
      if (outcome === 'meeting') {
        await patch('booked', true);
        await patch('followUp', when);
      } else if (outcome === 'callback' || outcome === 'no_answer') {
        if (outcome === 'callback' && spoke) await patch('contacted', true);
        if (when) await patch('followUp', when);
      } else if (outcome === 'not_interested') {
        await patch('contacted', true);
        await patch('followUp', '');
      }
      const detail = outcome === 'meeting'
        ? `ל-${shortDate(when)} · ${place}`
        : (outcome === 'callback' || outcome === 'no_answer') && when ? `— פולואפ ${shortDate(when)}` : undefined;
      const res = await fetch(`/api/admin/leads/${leadId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: callSummary(path, outcome, detail, extra) }),
      });
      if (!res.ok) throw new Error('note failed');
      onSaved();
      onClose();
    } catch {
      setError('השמירה נכשלה. נסה שוב.');
      setSaving(false);
    }
  }

  const trail = path.map((o) => o.log).filter(Boolean);

  return (
    // stopPropagation: בפופ-אפ הליד, לחיצה על הרקע סוגרת אותו — בלי זה כל לחיצה כאן הייתה מבעבעת וסוגרת הכל.
    <div className="fixed inset-0 z-[60] flex items-end justify-center overscroll-contain bg-black/50 sm:items-center sm:p-4" role="presentation" onClick={(e) => e.stopPropagation()}>
      <div
        className="flex max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-hairline bg-raised shadow-2xl sm:rounded-2xl"
        role="dialog" aria-modal="true" aria-label={`שיחה עם ${leadName}`}
      >
        <header className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.72rem] text-muted">שיחה מודרכת</p>
            <p className="truncate text-[0.98rem] font-medium">{leadName}</p>
          </div>
          {phone ? (
            <a href={telHref(phone)} className="shrink-0 rounded-md px-3 py-1.5 text-[0.82rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
              חיוג
            </a>
          ) : null}
          <button type="button" onClick={onClose} className="shrink-0 px-1 text-[0.9rem] text-muted hover:text-primary" aria-label="סגירה">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {trail.length > 0 ? (
            <p className="mb-3 text-[0.72rem] leading-relaxed text-muted">{trail.join(' ← ')}</p>
          ) : null}

          {outcome ? (
            <div className="space-y-4">
              <h2 className="text-[1.15rem]">{OUTCOME_LABELS[outcome]}</h2>

              {outcome === 'meeting' ? (
                <>
                  <label className="block">
                    <span className="text-[0.8rem] text-muted">מתי הפגישה?</span>
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 w-full rounded-md border border-strong bg-raised px-3 py-2.5 text-[0.95rem] outline-none" />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACES.map((p) => (
                      <button key={p} type="button" onClick={() => setPlace(p)} className="rounded-full border px-3 py-1.5 text-[0.82rem]"
                        style={place === p ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' } : { borderColor: 'var(--border-strong)' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {outcome === 'callback' || outcome === 'no_answer' ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <QuickPick label="בעוד שעתיים" onPick={() => setWhen(inHours(2))} />
                    <QuickPick label="מחר ב-10:00" onPick={() => setWhen(tomorrowAt(10))} />
                    <QuickPick label="בעוד יומיים ב-10:00" onPick={() => setWhen(daysAt(2, 10))} />
                  </div>
                  <label className="block">
                    <span className="text-[0.8rem] text-muted">מתי לחזור?</span>
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 w-full rounded-md border border-strong bg-raised px-3 py-2.5 text-[0.95rem] outline-none" />
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="text-[0.8rem] text-muted">מה עוד חשוב לזכור? (רשות)</span>
                <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3}
                  placeholder="שם איש הקשר, מספר שאמר, מה כואב לו…"
                  className="mt-1 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
              </label>

              {error ? <p className="text-[0.82rem]" style={{ color: 'var(--danger)' }}>{error}</p> : null}

              <button type="button" onClick={save} disabled={saving}
                className="w-full rounded-md py-3 text-[0.98rem] font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                {saving ? 'שומר…' : 'שמירה על הליד'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-[1.15rem]">{step.title}</h2>
              <div className="space-y-2 rounded-lg border-s-4 bg-sunken px-4 py-3" style={{ borderColor: 'var(--accent)' }}>
                {step.say.map((line) => (
                  <p key={line} className="text-[1rem] leading-relaxed">{line.replace('{lead}', leadName)}</p>
                ))}
              </div>
              {step.tip ? <p className="text-[0.8rem] leading-relaxed text-muted">{step.tip}</p> : null}
              <div className="grid gap-2">
                {step.options.map((option) => (
                  <button key={option.label} type="button" onClick={() => choose(option)}
                    className="rounded-lg border border-strong px-4 py-3 text-start text-[0.95rem] transition-colors hover:bg-sunken"
                    style={option.outcome ? { borderColor: 'var(--accent)' } : undefined}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {history.length > 0 || outcome ? (
          <footer className="border-t border-hairline px-4 py-2.5">
            <button type="button" onClick={back} className="text-[0.85rem] text-muted hover:text-primary">→ צעד אחורה</button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/** כפתור שפותח שיחה מודרכת — לעמוד הליד המלא, שהוא server component. */
export function CallGuideButton({ leadId, leadName, phone }: { leadId: string; leadName: string; phone: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md px-3.5 py-2 text-[0.85rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
        שיחה מודרכת
      </button>
      {open ? (
        <CallGuide leadId={leadId} leadName={leadName} phone={phone} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />
      ) : null}
    </>
  );
}

function QuickPick({ label, onPick }: { label: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="rounded-full border border-strong px-3 py-1.5 text-[0.82rem]">{label}</button>
  );
}

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inHours(h: number): string {
  const d = new Date(Date.now() + h * 3_600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return localInput(d);
}

function daysAt(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return localInput(d);
}

function tomorrowAt(hour: number): string {
  return daysAt(1, hour);
}

/** שעות עבודה בישראל: א׳–ה׳ 8:00–18:00, ו׳ עד 13:00, לא בשבת. */
function isBusinessTime(d: Date): boolean {
  const day = d.getDay();
  const h = d.getHours() + d.getMinutes() / 60;
  if (day === 6) return false;
  if (day === 5) return h >= 8 && h < 13;
  return h >= 8 && h < 18;
}

/** ברירת המחדל לחזרה: בוקר העסקים הבא ב-10:00, מדלג על שבת. */
function nextBusinessMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  while (d.getDay() === 6) d.setDate(d.getDate() + 1);
  return localInput(d);
}

/** "לא ענה": לנסות שוב בעוד שעתיים — אלא אם זה כבר אחרי שעות העבודה. */
function retryDefault(): string {
  const d = new Date(Date.now() + 2 * 3_600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return isBusinessTime(d) ? localInput(d) : nextBusinessMorning();
}

/** "2026-10-12T10:00" → "12.10 10:00" */
function shortDate(value: string): string {
  const [date, time] = value.split('T');
  const [, m, d] = (date ?? '').split('-');
  return `${Number(d)}.${Number(m)} ${time ?? ''}`.trim();
}
