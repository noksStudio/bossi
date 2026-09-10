import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrincipal, getDocument } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { ShareButton } from '@/components/app/share-button';
import { StatusPill } from '@/components/site/chrome';
import {
  daysUntil, docTypeLabel, documentUrl, expiryTone, formatBytes, formatDate, sourceLabel,
} from '@/lib/documents';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const doc = await asPrincipal(principal, (tx) => getDocument(tx, id));
  return { title: doc?.title ?? 'מסמך' };
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const doc = await asPrincipal(principal, (tx) => getDocument(tx, id));
  if (!doc) notFound();

  const url = documentUrl(doc.storage_key);
  // מסתיר את סרגל הכלים ואת חלונית הדפים של מציג ה-PDF, ומתאים לרוחב —
  // בלי זה המסמך מוצג זעיר בתוך ממשק של הדפדפן.
  const embedUrl = url ? `${url}#toolbar=0&navpanes=0&view=Fit` : null;
  const days = daysUntil(doc.expires_on);
  const tone = expiryTone(days);

  return (
    <div className="space-y-5">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/documents" className="hover:text-primary">מסמכים</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>{doc.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.4rem]">{doc.title}</h1>
            {doc.status === 'needs_review' ? <StatusPill tone="warning">ממתין לאישור</StatusPill> : null}
            {tone ? (
              <StatusPill tone={tone === 'neutral' ? 'neutral' : tone}>
                {days! < 0 ? `פג לפני ${Math.abs(days!)} יום` : `פג בעוד ${days} יום`}
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-1 text-[0.82rem] text-muted" dir="ltr">{doc.filename}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <ShareButton documentId={doc.id} />
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              פתח בכרטיסייה חדשה
            </a>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-hairline bg-sunken">
          {url ? (
            <object data={embedUrl!} type="application/pdf" className="h-[78vh] w-full">
              <div className="p-8 text-center text-[0.9rem] text-secondary">
                הדפדפן לא מציג PDF מוטמע.{' '}
                <a href={url} className="underline" target="_blank" rel="noreferrer">פתח את הקובץ</a>
              </div>
            </object>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[0.9rem] text-secondary">
                הקובץ נמצא באחסון שעוד לא חובר. המטא-דאטה, התיוק והחיפוש עובדים.
              </p>
            </div>
          )}
        </div>

        <dl className="space-y-0 rounded-lg border border-hairline p-4 text-[0.88rem]">
          <Row label="לקוח">
            {doc.customer_id ? (
              <Link href={`/customers/${doc.customer_id}`} className="hover:underline">
                {doc.customer_name}
              </Link>
            ) : (
              <span className="text-muted">לא משויך</span>
            )}
          </Row>
          <Row label="סוג">{docTypeLabel(doc.doc_type)}</Row>
          <Row label="ערוץ קליטה">{sourceLabel(doc.source)}</Row>
          <Row label="תאריך המסמך">{formatDate(doc.issued_on)}</Row>
          <Row label="נקלט">{formatDate(doc.created_at)}</Row>
          {doc.expires_on ? <Row label="בתוקף עד">{formatDate(doc.expires_on)}</Row> : null}
          {doc.amount ? (
            <Row label="סכום">{Number(doc.amount).toLocaleString('he-IL')} ₪</Row>
          ) : null}
          <Row label="גודל">{formatBytes(doc.byte_size)}</Row>
          {doc.doc_type_confidence !== null ? (
            <Row label="ביטחון הסיווג">
              {Math.round(doc.doc_type_confidence * 100)}%
              {doc.doc_type_confidence < 0.8 ? (
                <span className="ms-1.5 text-[0.75rem] text-muted">מתחת לסף — נדרש אישור</span>
              ) : null}
            </Row>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-2 last:border-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}
