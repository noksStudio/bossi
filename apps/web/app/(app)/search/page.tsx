import Link from 'next/link';
import { ChevronLeft, FileText, Search as SearchIcon, Users, X } from 'lucide-react';
import { asPrincipal, search } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { docTypeLabel, formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'חיפוש' };

const SUGGESTIONS = ['חוזה', 'אישור ניכוי', 'תעודת משלוח', 'הצעת מחיר', 'ביטוח', 'סיכום פגישה'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const principal = await requirePrincipal();
  const { q } = await searchParams;
  const hits = q ? await asPrincipal(principal, (tx) => search(tx, q)) : [];

  const customers = hits.filter((h) => h.kind === 'customer');
  const documents = hits.filter((h) => h.kind === 'document');

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <h1 className="text-[1.6rem]">חיפוש</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          מסמכים ולקוחות. מילים חלקיות ושגיאות כתיב קלות נתפסות גם הן.
        </p>
      </div>

      <form className="relative">
        <SearchIcon
          className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          name="q"
          defaultValue={q ?? ''}
          autoFocus
          placeholder="מה אתה מחפש?"
          className="w-full rounded-xl border border-strong bg-raised py-4 ps-12 pe-12 text-[1.05rem] shadow-sm outline-none ring-accent-quiet transition-shadow focus:ring-4"
        />
        {q ? (
          <Link
            href="/search"
            aria-label="נקה חיפוש"
            className="absolute inset-y-0 end-4 my-auto flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-primary"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        ) : null}
      </form>

      {!q ? (
        <div className="space-y-3">
          <p className="text-[0.85rem] text-muted">נסה למשל:</p>
          <ul className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <Link
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="inline-block rounded-full border border-hairline px-3.5 py-1.5 text-[0.85rem] text-secondary transition-all hover:border-strong hover:text-primary hover:shadow-sm"
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-[0.76rem] text-muted">
            טיפ: <kbd className="rounded-sm border border-hairline px-1.5 py-0.5 text-[0.7rem]" dir="ltr">Ctrl K</kbd>{' '}
            פותח את החיפוש המהיר מכל מסך.
          </p>
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-strong p-12 text-center">
          <SearchIcon className="mx-auto size-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="mt-3 text-[1.02rem]">לא נמצא כלום עבור ״{q}״</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-secondary">
            החיפוש כרגע לקסיקלי — הוא מוצא מילים שמופיעות במסמך. חיפוש שמבין
            שאלות בשפה חופשית ומחזיר ציטוט מהמקור נכנס בהמשך.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-[0.85rem] text-muted">
            {hits.length} תוצאות עבור ״{q}״
          </p>

          {customers.length > 0 ? (
            <ResultGroup title="לקוחות" count={customers.length} icon={Users}>
              {customers.map((c) => (
                <ResultCard
                  key={c.id}
                  href={`/customers/${c.id}`}
                  icon={Users}
                  title={c.title}
                  subtitle={c.subtitle ?? undefined}
                  query={q}
                />
              ))}
            </ResultGroup>
          ) : null}

          {documents.length > 0 ? (
            <ResultGroup title="מסמכים" count={documents.length} icon={FileText}>
              {documents.map((d) => (
                <ResultCard
                  key={d.id}
                  href={`/documents/${d.id}`}
                  icon={FileText}
                  title={d.title}
                  subtitle={d.subtitle ?? undefined}
                  meta={[docTypeLabel(d.doc_type), formatDate(d.created_at)]}
                  query={q}
                />
              ))}
            </ResultGroup>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title, count, icon: Icon, children,
}: {
  title: string;
  count: number;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-1.5 text-[0.8rem] text-muted">
        <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {title}
        <span className="tnum">· {count}</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ResultCard({
  href, icon: Icon, title, subtitle, meta, query,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  subtitle?: string;
  meta?: string[];
  query: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-xl border border-hairline bg-raised p-3.5 transition-all hover:border-strong hover:shadow-sm"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--surface-sunken)' }}
      >
        <Icon className="size-[1.1rem] text-muted" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.92rem]">
          <Highlight text={title} query={query} />
        </div>
        {subtitle || meta ? (
          <div className="mt-0.5 flex flex-wrap gap-x-2 truncate text-[0.75rem] text-muted">
            {meta?.map((m, i) => (
              <span key={i}>{i > 0 ? <span aria-hidden="true">· </span> : null}{m}</span>
            ))}
            {subtitle ? <span>{meta ? <span aria-hidden="true">· </span> : null}{subtitle}</span> : null}
          </div>
        ) : null}
      </div>
      <ChevronLeft className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}

/** מדגישה את החלק התואם לשאילתה בתוך הכותרת — התאמה חזותית מהירה. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (i === -1 || !query.trim()) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark
        className="rounded-sm px-0.5 font-medium"
        style={{ background: 'var(--warning-quiet)', color: 'var(--text-primary)' }}
      >
        {text.slice(i, i + query.trim().length)}
      </mark>
      {text.slice(i + query.trim().length)}
    </>
  );
}
