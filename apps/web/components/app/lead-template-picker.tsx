'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';

interface TemplateOption {
  id: string;
  name: string;
  body: string;
}

/**
 * מילוי placeholders קורה כאן, בקומפוננטת client, ולא ב-@bossi/db
 * (fillTemplate שם) — קומפוננטת client לעולם לא מייבאת מ-@bossi/db,
 * אפילו לא פונקציה טהורה כמו זו; היא גוררת את כל גרף המודול (כולל pg)
 * לתוך חבילת הדפדפן. אותה תבנית בדיוק בדיוק כמו document-type-field.tsx.
 */
function fill(body: string, contactName: string | null, businessName: string): string {
  return body
    .replaceAll('{{contact_name}}', contactName ?? '')
    .replaceAll('{{business_name}}', businessName);
}

export function LeadTemplatePicker({
  templates, contactName, businessName,
}: {
  templates: TemplateOption[];
  contactName: string | null;
  businessName: string;
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '');
  const [copied, setCopied] = useState(false);

  if (templates.length === 0) {
    return (
      <section className="rounded-lg border border-hairline p-4">
        <h2 className="mb-1.5 text-[0.95rem]">תבנית הודעה</h2>
        <p className="text-[0.82rem] text-muted">
          אין עדיין תבניות.{' '}
          <Link href="/leads/templates/new" className="hover:underline" style={{ color: 'var(--accent)' }}>
            הוסיפו אחת
          </Link>
        </p>
      </section>
    );
  }

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0]!;
  const filled = fill(selected.body, contactName, businessName);

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // דפדפן בלי הרשאת clipboard — הטקסט עדיין גלוי למעלה להעתקה ידנית.
    }
  }

  return (
    <section className="rounded-lg border border-hairline p-4">
      <h2 className="mb-2.5 text-[0.95rem]">תבנית הודעה</h2>

      <select
        value={selectedId || selected.id}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <p className="mt-3 whitespace-pre-wrap rounded-md bg-sunken p-3 text-[0.85rem] leading-relaxed">
        {filled}
      </p>

      <button
        type="button"
        onClick={copy}
        className="mt-2.5 flex items-center gap-1.5 rounded-md border border-strong px-3.5 py-1.5 text-[0.85rem]"
      >
        {copied ? (
          <>
            <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            הועתק
          </>
        ) : (
          <>
            <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            העתק
          </>
        )}
      </button>
    </section>
  );
}
