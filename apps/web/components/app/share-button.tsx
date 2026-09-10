'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

/**
 * כפתור שיתוף — פותח פופאובר עם קישור חד-פעמי לצפייה במסמך, בלי
 * שהצד השני צריך חשבון. הקישור נוצר רק בלחיצה, לא מראש: כל בקשה
 * מייצרת אסימון חדש (`document_shares` שורה חדשה), כך שאין אסימון
 * "ברירת מחדל" ישן שמסתובב בלי שאף אחד זוכר שהוא קיים.
 */
export function ShareButton({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function createLink() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlDays: 7 }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setLink(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !link) await createLink();
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const expiresLabel = link
    ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(
        new Date(link.expiresAt),
      )
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded-md border border-strong px-4 py-2 text-[0.88rem] text-secondary transition-colors hover:bg-sunken"
      >
        <Share2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        שיתוף
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="absolute top-full z-30 mt-2 w-80 rounded-xl border border-hairline bg-raised p-4 shadow-lg start-0"
        >
          <h3 className="text-[0.88rem] font-medium">קישור שיתוף</h3>
          <p className="mt-1 text-[0.76rem] text-muted">
            כל מי שמחזיק בקישור יכול לצפות במסמך הזה בלבד, בלי להתחבר.
          </p>

          {loading ? (
            <div className="mt-3 h-9 animate-pulse rounded-md bg-sunken" />
          ) : error ? (
            <p className="mt-3 text-[0.8rem]" style={{ color: 'var(--danger)' }}>
              משהו נכשל. <button type="button" onClick={createLink} className="underline">נסו שוב</button>
            </p>
          ) : link ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={link.url}
                  dir="ltr"
                  className="min-w-0 flex-1 truncate rounded-md border border-hairline bg-sunken px-2.5 py-1.5 text-[0.78rem]"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={copy}
                  aria-label="העתק קישור"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border border-hairline transition-colors hover:bg-sunken"
                >
                  {copied ? (
                    <Check className="size-4 text-accent" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Copy className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[0.72rem] text-muted">בתוקף עד {expiresLabel}</p>

              <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(link.url)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-md border border-hairline px-2.5 py-1.5 text-center text-[0.78rem] text-secondary transition-colors hover:bg-sunken"
                >
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent('מסמך מ-Bossi')}&body=${encodeURIComponent(link.url)}`}
                  className="flex-1 rounded-md border border-hairline px-2.5 py-1.5 text-center text-[0.78rem] text-secondary transition-colors hover:bg-sunken"
                >
                  מייל
                </a>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
