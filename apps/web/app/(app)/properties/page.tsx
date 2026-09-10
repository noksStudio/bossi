import Link from 'next/link';
import { asPrincipal, listLeases, listProperties } from '@bossi/db';
import { URGENCY_LABELS, formatILS, leaseTiming, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'נכסים' };

/**
 * הנכסים — הצד הפיזי של אותו מידע.
 *
 * המסך הזה עונה על "מה יש לי ומי יושב שם", בזמן ש-`/leases` עונה על
 * "מה נגמר ומתי". אותם נתונים, שתי שאלות שונות שנשאלות בזמנים שונים.
 */
export default async function PropertiesPage() {
  const principal = await requirePrincipal();

  const [properties, leases] = await Promise.all([
    asPrincipal(principal, (tx) => listProperties(tx)),
    asPrincipal(principal, (tx) => listLeases(tx, { status: 'active' })),
  ]);

  const leaseByProperty = new Map(leases.map((l) => [l.property_id, l]));
  const rented = properties.filter((p) => leaseByProperty.has(p.id));
  const vacant = properties.filter((p) => !leaseByProperty.has(p.id));
  const income = leases.reduce((s, l) => s + toAgorot(l.monthly_rent), 0);

  // תפוסה נמדדת בכסף ולא ביחידות: דירת 5 חדרים ריקה אינה שווה לדירת
  // חדר ריקה, ואחוז שמתעלם מזה מרגיע ללא סיבה.
  const occupancy = properties.length > 0 ? Math.round((rented.length / properties.length) * 100) : 0;

  const byCity = new Map<string, number>();
  for (const p of properties) byCity.set(p.city ?? 'אחר', (byCity.get(p.city ?? 'אחר') ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">נכסים</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {properties.length} נכסים · {[...byCity.entries()].map(([c, n]) => `${c} (${n})`).join(' · ')}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="נכסים" value={String(properties.length)} />
        <StatTile label="מושכרים" value={String(rented.length)} note={`תפוסה ${occupancy}%`} />
        <StatTile label="פנויים" value={String(vacant.length)} note={vacant.length ? 'לא מניבים' : 'הכול מושכר'} />
        <StatTile label="הכנסה חודשית" value={`${formatILS(income)} ₪`} note="מחוזים פעילים" />
      </div>

      {vacant.length > 0 ? (
        <section className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--warning)' }}>
          <header className="px-4 py-3" style={{ background: 'var(--warning-quiet)' }}>
            <h2 className="text-[0.98rem]" style={{ color: 'var(--warning)' }}>
              פנויים — לא מניבים <span className="tnum text-[0.8rem]">({vacant.length})</span>
            </h2>
          </header>
          <ul className="divide-y divide-hairline">
            {vacant.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.85rem]">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-[0.76rem] text-muted">{describe(p)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">מושכרים</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-[0.85rem]">
            <thead>
              <tr className="border-b border-hairline text-[0.72rem] text-muted">
                <th className="px-4 py-2 text-start font-normal">נכס</th>
                <th className="px-4 py-2 text-start font-normal">עיר</th>
                <th className="px-4 py-2 text-start font-normal">שוכר</th>
                <th className="px-4 py-2 text-end font-normal">שכ״ד</th>
                <th className="px-4 py-2 text-start font-normal">עד</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rented.map((p) => {
                const lease = leaseByProperty.get(p.id)!;
                const timing = leaseTiming(lease);
                return (
                  <tr key={p.id} className="hover:bg-sunken">
                    <td className="px-4 py-2.5">
                      <Link href={`/leases/${lease.id}`} className="hover:underline">{p.name}</Link>
                      <div className="text-[0.7rem] text-muted">{describe(p)}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-secondary">{p.city ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/customers/${lease.customer_id}`} className="hover:underline">
                        {lease.customer_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end tnum">
                      {formatILS(toAgorot(lease.monthly_rent))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {timing.urgency === 'quiet' ? (
                        <span className="text-[0.78rem] text-muted">{formatDate(lease.ends_on)}</span>
                      ) : (
                        <StatusPill tone={timing.urgency === 'upcoming' ? 'neutral' : timing.urgency === 'due' ? 'warning' : 'danger'}>
                          {URGENCY_LABELS[timing.urgency]}
                        </StatusPill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function describe(p: { rooms: string | null; size_sqm: number | null }): string {
  const parts: string[] = [];
  if (p.rooms) parts.push(`${Number(p.rooms)} חדרים`);
  if (p.size_sqm) parts.push(`${p.size_sqm} מ״ר`);
  return parts.join(' · ') || '—';
}
