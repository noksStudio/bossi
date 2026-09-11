'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Search, X } from 'lucide-react';

interface CustomerResult {
  id: string;
  display_name: string;
  status: string;
}

/**
 * שיוך/שינוי לקוח — לחיצה פותחת חיפוש (אותו נתיב `/api/customers/search`
 * שמזין את לוח הפקודות). זו בדיוק נקודת העריכה שההצעה האוטומטית של
 * ה-AI (ספרינט ד׳ הבא) צריכה: "שויך אוטומטית · שנה" מוביל לכאן.
 */
export function DocumentCustomerField({
  documentId, customerId, customerName,
}: {
  documentId: string;
  customerId: string | null;
  customerName: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.ok) setResults((await res.json()).results ?? []);
      } catch {
        /* בוטל */
      }
    }, 130);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, editing]);

  async function assign(nextCustomerId: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: nextCustomerId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
      setQuery('');
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {customerId ? (
          <Link href={`/customers/${customerId}`} className="hover:underline">{customerName}</Link>
        ) : (
          <span className="text-muted">לא משויך</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="שנה לקוח"
          className="text-muted transition-colors hover:text-primary"
        >
          <Pencil className="size-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1.5">
        <Search className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לקוח…"
          disabled={saving}
          className="w-40 border-b border-hairline bg-transparent py-0.5 text-[0.85rem] outline-none"
        />
        {customerId ? (
          <button
            type="button"
            onClick={() => assign(null)}
            aria-label="בטל שיוך"
            className="text-muted transition-colors hover:text-primary"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {results.length > 0 ? (
        <ul className="absolute top-full z-20 mt-1 w-52 rounded-md border border-hairline bg-raised py-1 shadow-lg start-0">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => assign(c.id)}
                className="block w-full truncate px-3 py-1.5 text-start text-[0.85rem] hover:bg-sunken"
              >
                {c.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
