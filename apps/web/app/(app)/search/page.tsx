import Link from 'next/link';
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

  const documents = hits.filter((h) => h.kind === 'document');
  const customers = hits.filter((h) => h.kind === 'customer');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[1.6rem]">חיפוש</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          מסמכים ולקוחות. מילים חלקיות ושגיאות כתיב קלות נתפסות גם הן.
        </p>
      </div>

      <form>
        <input
          name="q"
          defaultValue={q ?? ''}
          autoFocus
          placeholder="מה אתה מחפש?"
          className="w-full rounded-md border border-strong bg-raised px-4 py-3 text-[1rem] outline-none"
        />
      </form>

      {!q ? (
        <div className="space-y-3">
          <p className="text-[0.85rem] text-muted">נסה למשל:</p>
          <ul className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <Link
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="inline-block rounded-full border border-hairline px-3 py-1.5 text-[0.85rem] text-secondary transition-colors hover:border-strong hover:text-primary"
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">לא נמצא כלום עבור ״{q}״</h2>
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
            <section>
              <h2 className="mb-2.5 text-[0.8rem] text-muted">לקוחות</h2>
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                {customers.map((c) => (
                  <li key={c.id} className="px-4 py-3 transition-colors hover:bg-sunken">
                    <Link href={`/customers/${c.id}`} className="text-[0.92rem] hover:underline">
                      {c.title}
                    </Link>
                    {c.subtitle ? (
                      <div className="text-[0.75rem] text-muted">{c.subtitle}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {documents.length > 0 ? (
            <section>
              <h2 className="mb-2.5 text-[0.8rem] text-muted">מסמכים</h2>
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                {documents.map((d) => (
                  <li key={d.id} className="px-4 py-3 transition-colors hover:bg-sunken">
                    <Link href={`/documents/${d.id}`} className="text-[0.92rem] hover:underline">
                      {d.title}
                    </Link>
                    <div className="flex flex-wrap gap-x-2 text-[0.75rem] text-muted">
                      <span>{docTypeLabel(d.doc_type)}</span>
                      {d.subtitle ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{d.subtitle}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(d.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
