'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Result {
  id: string;
  display_name: string;
  status: string;
}

/**
 * ⌘K — קפיצה ללקוח בלי לעבור דרך הרשימה.
 *
 * זה הקיצור שהופך "איפה הלקוח הזה" משלוש לחיצות לשתי הקשות, וזו בדיוק
 * ההבטחה של שליפה. הוא נטען רק אחרי שנפתח, כדי לא לשלם עליו בכל עמוד.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setActive(0);
      inputRef.current?.focus();
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // השהיה קצרה כדי לא לשלוח בקשה על כל הקשה
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) setResults((await res.json()).results ?? []);
      } catch {
        /* בוטל */
      }
    }, 130);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  if (!open) return null;

  const go = (id: string) => {
    setOpen(false);
    router.push(`/customers/${id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-strong bg-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="חיפוש מהיר"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && results[active]) go(results[active]!.id);
          }}
          placeholder="קפיצה ללקוח…"
          className="w-full border-b border-hairline bg-transparent px-4 py-3.5 text-[0.95rem] outline-none"
        />

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-[0.85rem] text-muted">
            {query ? 'אין תוצאות' : 'הקלד שם לקוח'}
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.id)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[0.9rem]"
                  style={i === active ? { background: 'var(--surface-sunken)' } : undefined}
                >
                  <span className="min-w-0 flex-1 truncate">{r.display_name}</span>
                  {r.status !== 'active' ? (
                    <span className="shrink-0 text-[0.7rem] text-muted">{r.status}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3 border-t border-hairline px-4 py-2 text-[0.7rem] text-muted">
          <span>↑↓ ניווט</span>
          <span>↵ פתיחה</span>
          <span>esc סגירה</span>
        </div>
      </div>
    </div>
  );
}
