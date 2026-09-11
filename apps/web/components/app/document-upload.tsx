'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UploadCloud } from 'lucide-react';

interface UploadedDoc {
  id: string;
  reused: boolean;
  docType: { value: string; label: string; confidence: number } | null;
  customerMatch: { customerId: string; displayName: string; confidence: number } | null;
}

/**
 * אזור העלאה — גרירה או לחיצה, אותו איזור. קובץ אחד או כמה בבת אחת.
 * כל קובץ הופך למסמך בסטטוס "ממתין לאישור" (אין עדיין סיווג אוטומטי),
 * ולכן ההעלאה עצמה לא שואלת שום שאלה מסווגת — מישהו יתייג אחר כך.
 */
export function DocumentUpload({ customerId }: { customerId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      if (customerId) form.append('customerId', customerId);

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('upload_failed');
      const data: { documents: UploadedDoc[] } = await res.json();

      const reused = data.documents.filter((d) => d.reused).length;
      const label = data.documents.length === 1 ? 'מסמך הועלה' : `${data.documents.length} מסמכים הועלו`;
      const lines = [reused > 0 ? `${label} · ${reused} כבר היו קיימים ולא נשמרו פעם נוספת` : label];

      // תיוק אוטומטי הוא הצעה, לא קביעה — מוצג כאן כדי שהמשתמש יידע
      // מיד מה נקבע, אבל תמיד ניתן לשינוי בעמוד המסמך (הספרינט הקודם).
      const classified = data.documents.filter((d) => d.docType);
      const filed = data.documents.filter((d) => d.customerMatch);
      if (classified.length === 1 && data.documents.length === 1) {
        lines.push(`זוהה כ${classified[0]!.docType!.label}`);
      } else if (classified.length > 0) {
        lines.push(`${classified.length} סווגו אוטומטית`);
      }
      if (filed.length === 1 && data.documents.length === 1) {
        lines.push(`שויך ל${filed[0]!.customerMatch!.displayName} · אפשר לשנות בעמוד המסמך`);
      } else if (filed.length > 0) {
        lines.push(`${filed.length} שויכו ללקוח אוטומטית · אפשר לשנות בעמוד כל מסמך`);
      }
      if (classified.length === 0 && data.documents.length > 0) {
        lines.push('ממתינים לאישור');
      }

      setMessage({ text: lines.join(' — ') });
      router.refresh();
    } catch {
      setMessage({ text: 'ההעלאה נכשלה. נסו שוב.', error: true });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-5 py-4 text-center transition-colors ${
          dragging ? 'border-strong bg-sunken' : 'border-hairline hover:border-strong hover:bg-sunken'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <p className="text-[0.86rem] text-secondary">מעלה…</p>
        ) : (
          <>
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--surface-sunken)' }}
            >
              {dragging ? (
                <UploadCloud className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Plus className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
              )}
            </span>
            <p className="text-[0.86rem] text-secondary">
              {dragging ? 'שחררו כאן' : 'גררו קבצים לכאן, או לחצו כדי לבחור'}
            </p>
          </>
        )}
      </div>

      {message ? (
        <p
          className="mt-2 text-[0.8rem]"
          style={message.error ? { color: 'var(--danger)' } : undefined}
        >
          {message.error ? message.text : <span className="text-muted">{message.text}</span>}
        </p>
      ) : null}
    </div>
  );
}
