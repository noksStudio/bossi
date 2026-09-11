import Link from 'next/link';
import { asPrincipal, LEAD_SOURCES, LEAD_STAGES, listLeads } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לידים' };

const STAGE_TONE: Record<string, 'positive' | 'warning' | 'neutral'> = {
  new: 'neutral',
  contacted: 'neutral',
  qualified: 'warning',
  proposal: 'warning',
  won: 'positive',
  lost: 'neutral',
};

function countLabel(n: number): string {
  if (n === 0) return 'אין תוצאות';
  if (n === 1) return 'ליד אחד';
  if (n === 2) return 'שני לידים';
  return `${n} לידים`;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const principal = await requirePrincipal();
  const { q, stage } = await searchParams;

  const leads = await asPrincipal(principal, (tx) =>
    listLeads(tx, { search: q, stage: stage && stage !== 'all' ? (stage as never) : undefined }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem]">לידים</h1>
          <p className="mt-1 text-[0.88rem] text-muted">{countLabel(leads.length)}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/leads/import" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">
            ייבוא מ-Google Places
          </Link>
          <Link
            href="/leads/new"
            className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            ליד חדש
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2.5">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="חיפוש לפי שם"
          className="min-w-56 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
        />
        <select
          name="stage"
          defaultValue={stage ?? 'all'}
          className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
        >
          <option value="all">כל השלבים</option>
          {Object.entries(LEAD_STAGES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">
          סנן
        </button>
      </form>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">{q || stage ? 'לא נמצא ליד כזה' : 'עוד אין לידים'}</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-secondary">
            {q || stage ? 'נסו סינון אחר.' : 'הוסיפו את הראשון — פנייה קרה, הפניה, כל דבר לפני שהוא לקוח.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-[0.9rem]">
            <thead>
              <tr className="border-b border-hairline bg-sunken text-[0.76rem] text-muted">
                <th className="px-4 py-2.5 text-start font-medium">ליד</th>
                <th className="px-4 py-2.5 text-start font-medium">שלב</th>
                <th className="hidden px-4 py-2.5 text-start font-medium sm:table-cell">מקור</th>
                <th className="hidden px-4 py-2.5 text-start font-medium lg:table-cell">מפנה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {leads.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-sunken">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                      {l.display_name}
                    </Link>
                    {l.contact_name ? <div className="text-[0.75rem] text-muted">{l.contact_name}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STAGE_TONE[l.stage] ?? 'neutral'}>{LEAD_STAGES[l.stage]}</StatusPill>
                  </td>
                  <td className="hidden px-4 py-3 text-secondary sm:table-cell">
                    {l.source ? (LEAD_SOURCES[l.source as keyof typeof LEAD_SOURCES] ?? l.source) : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-secondary lg:table-cell">
                    {l.referred_by_name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
