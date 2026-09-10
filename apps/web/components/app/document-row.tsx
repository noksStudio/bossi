import Link from 'next/link';
import type { DocumentRow } from '@bossi/db';
import { DocumentCheckbox } from '@/components/app/document-selection';
import { StatusPill } from '@/components/site/chrome';
import { daysUntil, docTypeLabel, expiryTone, formatDate, sourceLabel } from '@/lib/documents';

export function DocumentRowItem({ doc, showCustomer = true }: { doc: DocumentRow; showCustomer?: boolean }) {
  const days = daysUntil(doc.expires_on);
  const tone = expiryTone(days);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-sunken">
      <DocumentCheckbox id={doc.id} title={doc.title} />
      <DocIcon />
      <div className="min-w-0 flex-1">
        <Link href={`/documents/${doc.id}`} className="text-[0.9rem] hover:underline">
          {doc.title}
        </Link>
        <div className="flex flex-wrap gap-x-2 text-[0.72rem] text-muted">
          <span>{docTypeLabel(doc.doc_type)}</span>
          <span aria-hidden="true">·</span>
          <span>{sourceLabel(doc.source)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(doc.created_at)}</span>
          {showCustomer && doc.customer_name ? (
            <>
              <span aria-hidden="true">·</span>
              <Link href={`/customers/${doc.customer_id}`} className="hover:text-primary">
                {doc.customer_name}
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {doc.status === 'needs_review' ? <StatusPill tone="warning">ממתין לאישור</StatusPill> : null}
      {tone ? (
        <StatusPill tone={tone === 'neutral' ? 'neutral' : tone}>
          {days! < 0 ? `פג לפני ${Math.abs(days!)} יום` : `פג בעוד ${days} יום`}
        </StatusPill>
      ) : null}
    </li>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
      <path d="M4 1.75h4.6L12.25 5.4v8.85a.9.9 0 0 1-.9.9H4a.9.9 0 0 1-.9-.9V2.65a.9.9 0 0 1 .9-.9Z"
        stroke="var(--text-muted)" strokeWidth="1.3" />
      <path d="M8.4 2v3.6h3.6" stroke="var(--text-muted)" strokeWidth="1.3" />
    </svg>
  );
}
