import Link from 'next/link';
import { asPrincipal, listCustomers } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לקוחות' };

function countLabel(n: number): string {
  if (n === 0) return 'אין תוצאות';
  if (n === 1) return 'לקוח אחד';
  if (n === 2) return 'שני לקוחות';
  return `${n} לקוחות`;
}

const STATUS: Record<string, { label: string; tone: 'positive' | 'warning' | 'neutral' }> = {
  active: { label: 'פעיל', tone: 'positive' },
  prospect: { label: 'ליד', tone: 'warning' },
  dormant: { label: 'רדום', tone: 'neutral' },
  archived: { label: 'בארכיון', tone: 'neutral' },
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const principal = await requirePrincipal();
  const { q, status } = await searchParams;

  const customers = await asPrincipal(principal, (tx) =>
    listCustomers(tx, { search: q, status: status && status !== 'all' ? status : undefined }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem]">לקוחות</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            {countLabel(customers.length)}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          לקוח חדש
        </Link>
      </div>

      <form className="flex flex-wrap gap-2.5">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="חיפוש לפי שם או ח״פ"
          className="min-w-56 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
        />
        <select
          name="status"
          defaultValue={status ?? 'all'}
          className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
        >
          <option value="all">כל הסטטוסים</option>
          {Object.entries(STATUS).map(([value, s]) => (
            <option key={value} value={value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">
          סנן
        </button>
      </form>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">{q ? 'לא נמצא לקוח כזה' : 'עוד אין לקוחות'}</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-secondary">
            {q ? 'נסה שם אחר, או חלק מהשם.' : 'הוסף את הראשון, וכל מה שיגיע ממנו ינחת על הכרטיס שלו.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-[0.9rem]">
            <thead>
              <tr className="border-b border-hairline bg-sunken text-[0.76rem] text-muted">
                <th className="px-4 py-2.5 text-start font-medium">לקוח</th>
                <th className="px-4 py-2.5 text-start font-medium">סטטוס</th>
                <th className="hidden px-4 py-2.5 text-start font-medium sm:table-cell">תנאי תשלום</th>
                <th className="hidden px-4 py-2.5 text-start font-medium lg:table-cell">תגיות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {customers.map((c) => {
                const s = STATUS[c.status] ?? { label: c.status, tone: 'neutral' as const };
                return (
                  <tr key={c.id} className="transition-colors hover:bg-sunken">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                        {c.display_name}
                      </Link>
                      {c.legal_name ? (
                        <div className="text-[0.75rem] text-muted">{c.legal_name}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    </td>
                    <td className="hidden px-4 py-3 text-secondary sm:table-cell">
                      שוטף + {c.payment_terms_days}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="rounded-sm bg-sunken px-1.5 py-0.5 text-[0.7rem] text-secondary">
                            {t}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
