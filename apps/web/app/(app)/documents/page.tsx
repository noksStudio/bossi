import { asPrincipal, DOC_TYPES, documentStats, listDocuments, SOURCES } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { DocumentRowItem } from '@/components/app/document-row';
import { StatTile } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'מסמכים' };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; source?: string; status?: string; expiring?: string }>;
}) {
  const principal = await requirePrincipal();
  const p = await searchParams;

  const [docs, stats] = await Promise.all([
    asPrincipal(principal, (tx) =>
      listDocuments(tx, {
        search: p.q,
        docType: p.type && p.type !== 'all' ? p.type : undefined,
        source: p.source && p.source !== 'all' ? p.source : undefined,
        status: p.status && p.status !== 'all' ? p.status : undefined,
        expiringWithinDays: p.expiring ? 60 : undefined,
        limit: 200,
      }),
    ),
    asPrincipal(principal, (tx) => documentStats(tx)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">מסמכים</h1>
        <p className="mt-1 text-[0.88rem] text-muted">הכל נכנס לבד ומתויק ללקוח הנכון</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline sm:grid-cols-4">
        <StatTile label="סה״כ מסמכים" value={stats.total.toLocaleString('he-IL')} href="/documents" />
        <StatTile label="נקלטו החודש" value={stats.this_month.toLocaleString('he-IL')} href="/documents" />
        <StatTile label="ממתינים לאישור" value={String(stats.needs_review)} href="/documents?status=needs_review" />
        <StatTile label="תוקף פג בקרוב" value={String(stats.expiring_soon)} note="60 יום" href="/documents?expiring=1" />
      </div>

      <form className="flex flex-wrap gap-2.5">
        <input
          name="q"
          defaultValue={p.q ?? ''}
          placeholder="חיפוש בשם המסמך"
          className="min-w-52 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
        />
        <Select name="type" value={p.type} all="כל הסוגים" options={DOC_TYPES} />
        <Select name="source" value={p.source} all="כל הערוצים" options={SOURCES} />
        <Select
          name="status"
          value={p.status}
          all="כל הסטטוסים"
          options={{ filed: 'תויק', needs_review: 'ממתין לאישור', archived: 'בארכיון' }}
        />
        <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">
          סנן
        </button>
      </form>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">אין מסמכים שתואמים</h2>
          <p className="mt-2 text-[0.88rem] text-secondary">נסה לשחרר את הסינון.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline">
          <div className="border-b border-hairline bg-sunken px-4 py-2 text-[0.76rem] text-muted">
            {docs.length === 1 ? 'מסמך אחד' : `${docs.length} מסמכים`}
          </div>
          <ul className="divide-y divide-hairline">
            {docs.map((d) => (
              <DocumentRowItem key={d.id} doc={d} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Select({
  name,
  value,
  all,
  options,
}: {
  name: string;
  value?: string;
  all: string;
  options: Record<string, string>;
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? 'all'}
      className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
    >
      <option value="all">{all}</option>
      {Object.entries(options).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
