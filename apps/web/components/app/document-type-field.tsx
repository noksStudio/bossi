'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * שינוי סוג מסמך — לחיצה הופכת את התווית לתיבת בחירה. ה-options
 * מגיעים כ-prop מהעמוד (server component) בכוונה: קומפוננטת client
 * לעולם לא מייבאת מ-@bossi/db — אפילו רק קבוע כמו DOC_TYPES גורר
 * את כל גרף המודול שלו (כולל pg) לתוך חבילת הדפדפן.
 */
export function DocumentTypeField({
  documentId, currentType, currentLabel, options,
}: {
  documentId: string;
  currentType: string | null;
  currentLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(docType: string) {
    if (docType === currentType) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-secondary transition-colors hover:text-primary hover:underline"
      >
        {currentLabel}
        <Pencil className="size-3 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  }

  return (
    <select
      autoFocus
      defaultValue={currentType ?? ''}
      disabled={saving}
      onChange={(e) => save(e.target.value)}
      onBlur={() => setEditing(false)}
      className="rounded-md border border-strong bg-raised px-2 py-1 text-[0.85rem] outline-none"
    >
      <option value="" disabled>בחרו סוג</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
