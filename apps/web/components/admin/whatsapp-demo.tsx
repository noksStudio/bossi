'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProspectNoteRow } from '@bossi/db';
import { demoInviteMessage, isIsraeliMobile, whatsAppHref } from '@/lib/whatsapp';

/**
 * שליחת קישור לדמו בוואטסאפ תוך כדי שיחה. בדרך כלל מדברים עם נייח של
 * העסק ומבקשים נייד — לכן המספר נפרד מהטלפון של הליד ולא דורס אותו.
 * נפתח wa.me עם הודעה מוכנה, ונרשמת שורה בהיסטוריה של הליד.
 */
export function WhatsAppDemo({
  leadId,
  phone,
  onLogged,
}: {
  leadId: string;
  phone: string | null;
  onLogged?: (notes: ProspectNoteRow[]) => void;
}) {
  const router = useRouter();
  const [to, setTo] = useState(phone && isIsraeliMobile(phone) ? phone : '');
  const [contact, setContact] = useState('');
  const [origin, setOrigin] = useState('');
  const [edited, setEdited] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const message = edited ?? demoInviteMessage({ contactName: contact, link: `${origin}/signin` });
  const href = whatsAppHref(to, message);

  function logSent() {
    void fetch(`/api/admin/leads/${leadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `נשלח קישור לדמו בוואטסאפ ל-${to}${contact.trim() ? ` (${contact.trim()})` : ''}` }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.notes) return;
        if (onLogged) onLogged(data.notes);
        else router.refresh();
      });
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="text-[0.72rem] text-muted">נייד לשליחה</span>
          <input
            value={to} onChange={(e) => setTo(e.target.value)} inputMode="tel" dir="ltr" placeholder="05X-XXXXXXX"
            className="mt-0.5 block w-full rounded-md border border-strong bg-raised px-2.5 py-2 text-[0.88rem] outline-none focus:border-accent"
          />
        </label>
        <label className="block min-w-0">
          <span className="text-[0.72rem] text-muted">שם איש הקשר</span>
          <input
            value={contact} onChange={(e) => { setContact(e.target.value); setEdited(null); }} placeholder="רשות"
            className="mt-0.5 block w-full rounded-md border border-strong bg-raised px-2.5 py-2 text-[0.88rem] outline-none focus:border-accent"
          />
        </label>
      </div>

      <details>
        <summary className="cursor-pointer text-[0.76rem] text-muted">ההודעה שתישלח (אפשר לערוך)</summary>
        <textarea
          value={message} onChange={(e) => setEdited(e.target.value)} rows={8}
          className="mt-1.5 block w-full resize-y rounded-md border border-strong bg-raised px-2.5 py-2 text-[0.82rem] leading-relaxed outline-none focus:border-accent"
        />
      </details>

      {href ? (
        <a
          href={href} target="_blank" rel="noreferrer" onClick={logSent}
          className="flex items-center justify-center rounded-md py-2.5 text-[0.9rem] font-medium text-white"
          style={{ background: 'var(--positive)' }}
        >
          שליחה בוואטסאפ
        </a>
      ) : (
        <p className="rounded-md border border-dashed border-strong py-2.5 text-center text-[0.8rem] text-muted">
          {to.trim() ? 'המספר לא תקין' : 'הקלד נייד כדי לשלוח'}
        </p>
      )}
    </div>
  );
}
