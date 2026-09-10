import Link from 'next/link';
import { asPrincipal, listProducts, productCategories } from '@bossi/db';
import { STOCK_LABELS, availableToPromise, formatILS, stockStatus, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'קטלוג' };

/**
 * הקטלוג — מה אנחנו מוכרים, בכמה, וכמה מזה נשאר.
 *
 * מחיר ומלאי מוצגים באותה שורה בכוונה. מחירון שמנותק מהמלאי מוביל
 * להצעת מחיר על משהו שאין, וזה בדיוק מה שהמערכת אמורה למנוע.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const principal = await requirePrincipal();
  const { c, q } = await searchParams;

  const [products, categories] = await Promise.all([
    asPrincipal(principal, (tx) => listProducts(tx, { category: c, query: q, status: 'active' })),
    asPrincipal(principal, (tx) => productCategories(tx)),
  ]);

  const stockValue = products.reduce(
    (sum, p) => sum + Math.round(toAgorot(p.cost_price ?? p.list_price) * Number(p.on_hand)),
    0,
  );
  const customPrices = products.reduce((sum, p) => sum + p.custom_prices, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem]">קטלוג ומחירונים</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            {products.length} מוצרים פעילים · {customPrices} מחירים פר-לקוח
          </p>
        </div>
        <form className="flex items-center gap-2">
          {c ? <input type="hidden" name="c" value={c} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="שם מוצר או מק״ט"
            className="w-56 rounded-md border border-hairline bg-transparent px-3 py-1.5 text-[0.85rem]"
          />
          <button
            type="submit"
            className="rounded-md border border-strong px-3 py-1.5 text-[0.82rem] text-secondary transition-colors hover:bg-sunken"
          >
            חפש
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="מוצרים פעילים" value={String(products.length)} />
        <StatTile label="קטגוריות" value={String(categories.length)} />
        <StatTile label="שווי מלאי" value={`${formatILS(stockValue)} ₪`} note="לפי מחיר עלות" />
        <StatTile
          label="פריטים ללא מלאי זמין"
          value={String(products.filter((p) => availableToPromise(p) <= 0).length)}
          note="לא ניתן להבטיח ללקוח"
        />
      </div>

      <nav className="flex flex-wrap gap-1.5">
        <Chip href={q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog'} active={!c}>
          הכול
        </Chip>
        {categories.map((cat) => (
          <Chip
            key={cat.category}
            href={`/catalog?c=${encodeURIComponent(cat.category)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            active={c === cat.category}
          >
            {cat.category} <span className="tnum opacity-60">{cat.count}</span>
          </Chip>
        ))}
      </nav>

      <section className="overflow-hidden rounded-lg border border-hairline">
        {products.length === 0 ? (
          <p className="px-4 py-12 text-center text-[0.88rem] text-muted">לא נמצאו מוצרים.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-[0.85rem]">
              <thead>
                <tr className="border-b border-hairline text-[0.72rem] text-muted">
                  <th className="px-4 py-2 text-start font-normal">מק״ט</th>
                  <th className="px-4 py-2 text-start font-normal">מוצר</th>
                  <th className="px-4 py-2 text-end font-normal">מחירון</th>
                  <th className="px-4 py-2 text-end font-normal">זמין</th>
                  <th className="px-4 py-2 text-start font-normal">מלאי</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {products.map((p) => {
                  const atp = availableToPromise(p);
                  const status = stockStatus(p);
                  return (
                    <tr key={p.id} className="hover:bg-sunken">
                      <td className="whitespace-nowrap px-4 py-2.5 tnum text-muted" dir="ltr">
                        {p.sku}
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{p.name}</div>
                        {p.custom_prices > 0 ? (
                          <div className="text-[0.7rem] text-muted">
                            {p.custom_prices} {p.custom_prices === 1 ? 'לקוח עם מחיר משלו' : 'לקוחות עם מחיר משלהם'}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end tnum">
                        {formatILS(toAgorot(p.list_price), { decimals: true })}
                        <span className="ms-1 text-[0.7rem] text-muted">₪ / {p.unit}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end tnum font-medium">
                        {atp > 0 ? atp.toLocaleString('he-IL') : '0'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <StatusPill tone={stockTone(status)}>{STOCK_LABELS[status]}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border px-3 py-1 text-[0.8rem] transition-colors"
      style={
        active
          ? { background: 'var(--text-primary)', color: 'var(--surface)', borderColor: 'var(--text-primary)' }
          : { borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }
      }
    >
      {children}
    </Link>
  );
}

function stockTone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'out') return 'danger';
  if (status === 'critical') return 'warning';
  if (status === 'low') return 'neutral';
  return 'positive';
}
