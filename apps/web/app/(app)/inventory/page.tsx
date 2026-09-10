import { asPrincipal, listProducts } from '@bossi/db';
import { STOCK_LABELS, STOCK_RANK, availableToPromise, formatILS, stockStatus, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'מלאי' };

/**
 * מלאי — ממוין לפי **מה שדורש פעולה**, לא לפי שם.
 *
 * ההבחנה שכל המסך עומד עליה: `במחסן` אינו `זמין להבטחה`. הזמנה שאושרה
 * כבר לקחה סחורה שעוד לא יצאה. מסך שמראה רק את מה שבמחסן גורם למכור
 * פעמיים את אותו פריט.
 */
export default async function InventoryPage() {
  const principal = await requirePrincipal();
  const products = await asPrincipal(principal, (tx) => listProducts(tx, { status: 'active' }));

  const rows = products
    .map((p) => ({ ...p, atp: availableToPromise(p), status: stockStatus(p) }))
    .sort((a, b) => STOCK_RANK[a.status] - STOCK_RANK[b.status] || a.name.localeCompare(b.name, 'he'));

  const risky = rows.filter((r) => r.status !== 'ok');
  const allocated = rows.reduce((s, r) => s + Number(r.allocated), 0);
  const reorderValue = risky.reduce(
    (s, r) => s + Math.round(toAgorot(r.cost_price ?? r.list_price) * Math.max(0, Number(r.reorder_point) - r.atp)),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">מלאי</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {risky.length === 0
            ? 'כל הפריטים מעל סף ההזמנה מחדש.'
            : `${risky.length} ${risky.length === 1 ? 'פריט דורש' : 'פריטים דורשים'} הזמנה מהספק.`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="אזל" value={String(rows.filter((r) => r.status === 'out').length)} note="אין מה להבטיח" />
        <StatTile label="מתחת לסף" value={String(rows.filter((r) => r.status === 'critical').length)} note="להזמין עכשיו" />
        <StatTile label="מוקצה להזמנות" value={allocated.toLocaleString('he-IL')} note="יצא מהמלאי הזמין" />
        <StatTile label="חוסר להשלמה" value={`${formatILS(reorderValue)} ₪`} note="לפי מחיר עלות" />
      </div>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">מצב מלאי</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            <b className="font-medium text-secondary">זמין</b> = במחסן פחות מה שכבר הוקצה להזמנות מאושרות
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[50rem] text-[0.85rem]">
            <thead>
              <tr className="border-b border-hairline text-[0.72rem] text-muted">
                <th className="px-4 py-2 text-start font-normal">מוצר</th>
                <th className="px-4 py-2 text-end font-normal">במחסן</th>
                <th className="px-4 py-2 text-end font-normal">מוקצה</th>
                <th className="px-4 py-2 text-end font-normal">זמין</th>
                <th className="px-4 py-2 text-end font-normal">סף</th>
                <th className="px-4 py-2 text-start font-normal">מצב</th>
                <th className="px-4 py-2 text-start font-normal">אספקה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-sunken">
                  <td className="px-4 py-2.5">
                    <div>{r.name}</div>
                    <div className="tnum text-[0.7rem] text-muted" dir="ltr">{r.sku}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end tnum text-secondary">
                    {Number(r.on_hand).toLocaleString('he-IL')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end tnum text-muted">
                    {Number(r.allocated) > 0 ? `−${Number(r.allocated).toLocaleString('he-IL')}` : '—'}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-2.5 text-end tnum font-medium"
                    style={r.atp <= 0 ? { color: 'var(--danger)' } : undefined}
                  >
                    {r.atp.toLocaleString('he-IL')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end tnum text-muted">
                    {Number(r.reorder_point).toLocaleString('he-IL')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <StatusPill tone={tone(r.status)}>{STOCK_LABELS[r.status]}</StatusPill>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[0.78rem] text-muted">
                    {r.lead_days > 0 ? `${r.lead_days} ימים` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function tone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'out') return 'danger';
  if (status === 'critical') return 'warning';
  if (status === 'low') return 'neutral';
  return 'positive';
}
