'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

/**
 * בחירה מרובה של מסמכים ושיתוף שלהם ביחד בהודעת WhatsApp אחת —
 * קישור נפרד לכל מסמך (`createDocumentShare` הרגיל, אין טבלת "חבילה"
 * חדשה), כל השורות בהודעה אחת. Context ולא prop-drilling כי
 * `DocumentRowItem` נשאר server component; רק תיבת הסימון עצמה,
 * ופס הפעולה למטה, הם ה-client islands.
 */

interface SelectionContextValue {
  isSelected: (id: string) => boolean;
  toggle: (id: string, title: string) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function DocumentSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  const toggle = useCallback((id: string, title: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, title);
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return (
    <SelectionContext.Provider value={{ isSelected, toggle }}>
      {children}
      <BulkShareBar selected={selected} onClear={() => setSelected(new Map())} />
    </SelectionContext.Provider>
  );
}

function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('DocumentCheckbox חייב לרוץ בתוך DocumentSelectionProvider');
  return ctx;
}

export function DocumentCheckbox({ id, title }: { id: string; title: string }) {
  const { isSelected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={isSelected(id)}
      onClick={(e) => e.stopPropagation()}
      onChange={() => toggle(id, title)}
      aria-label={`בחר את ${title}`}
      className="size-4 shrink-0 accent-current"
    />
  );
}

function BulkShareBar({ selected, onClear }: { selected: Map<string, string>; onClear: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (selected.size === 0) return null;

  async function shareViaWhatsApp() {
    setLoading(true);
    setError(false);
    // נפתח לשונית ריקה עכשיו, בתוך אותה תגובת-משתמש — כדי שלא תיחסם
    // כ-popup אחרי ה-await של הבקשה לשרת.
    const tab = window.open('', '_blank');
    try {
      const res = await fetch('/api/documents/share-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: [...selected.keys()] }),
      });
      if (!res.ok) throw new Error('failed');
      const data: { shares: Array<{ title: string; url: string }> } = await res.json();

      const lines = data.shares.map((s) => `${s.title}: ${s.url}`);
      const text = `מסמכים מ-Bossi:\n${lines.join('\n')}`;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

      if (tab) tab.location.href = waUrl;
      else window.open(waUrl, '_blank');
      onClear();
    } catch {
      tab?.close();
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-24 z-20 flex justify-center px-4 lg:bottom-5">
      <div className="flex items-center gap-3 rounded-full border border-strong bg-raised px-4 py-2.5 shadow-lg">
        <span className="text-[0.84rem] tnum">{selected.size} נבחרו</span>
        <button
          type="button"
          onClick={shareViaWhatsApp}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.82rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#25D366' }}
        >
          <MessageCircle className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {loading ? 'שולח…' : 'שיתוף בווטסאפ'}
        </button>
        {error ? <span style={{ color: 'var(--danger)' }} className="text-[0.78rem]">נכשל, נסו שוב</span> : null}
        <button
          type="button"
          onClick={onClear}
          aria-label="נקה בחירה"
          className="flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-primary"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
