import Link from 'next/link';
import { asPrincipal, listInvoices, listPayments } from '@bossi/db';
import {
  BUCKET_LABELS, BUCKET_ORDER, aging, bucketOf, daysOverdue,
  formatILS, openBalance, received, toAgorot,
} from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'חיוב' };

/**
 * מסך החיוב עונה על שאלה אחת: **כמה כסף שלי נמצא אצל אחרים, וכמה זמן.**
 *
 * העמודות הן 30/60/90 כי זו החלוקה שרואה החשבון של בעל העסק מדבר בה.
 * חלוקה "חכמה" יותר הייתה מדויקת יותר וגם כזו שאף אחד לא סומך עליה.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const principal = await requirePrincipal();
  const { bucket } = await searchParams;

  const [invoices, payments] = await Promise.all([
    asPrincipal(principal, (tx) => listInvoices(tx, { openOnly: true })),
    asPrincipal(principal, (tx) => listPayments(tx, { since: monthStart(), limit: 300 })),
  ]);

  const book = aging(invoices);
  const monthReceived = received(payments);
  const shown = bucket
    ? invoices.filter((i) => bucketOf(i) === bucket)
    : [...invoices].sort((a, b) => daysOverdue(b) - daysOverdue(a));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">חיוב וחשבוניות</h1>
        <p className="mt-1 text-[0.88rem] text-muted">{headline(book)}</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="פתוח סה״כ" value={`${formatILS(book.total)} ₪`} note={`${invoices.length} חשבוניות`} />
        <StatTile
          label="באיחור"
          value={`${formatILS(book.overdue)} ₪`}
          note={book.overdueCount > 0 ? `${book.overdueCount} חשבוניות` : 'אין איחורים'}
        />
        <StatTile
          label="גיל ממוצע"
          value={book.weightedAgeDays > 0 ? `${book.weightedAgeDays} יום` : '—'}
          note="משוקלל בכסף"
        />
        <StatTile label="נכנס החודש" value={`${formatILS(monthReceived)} ₪`} note={`${payments.length} תקבולים`} />
      </div>

      {/* ── האייג׳ינג ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="flex items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">גיל החוב</h2>
          <p className="text-[0.76rem] text-muted">לחצו על עמודה כדי לסנן</p>
        </header>
        <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline sm:grid-cols-5">
          {BUCKET_ORDER.map((b) => {
            const cell = book.buckets[b];
            const share = book.total > 0 ? cell.amount / book.total : 0;
            const active = bucket === b;
            return (
              <Link
                key={b}
                href={active ? '/billing' : `/billing?bucket=${b}`}
                className="group min-w-0 px-4 py-3.5 transition-colors hover:bg-sunken"
                style={active ? { background: 'var(--surface-sunken)' } : undefined}
              >
                <div className="truncate text-[0.72rem] text-muted">{BUCKET_LABELS[b]}</div>
                <div className="mt-1 text-[1.15rem] font-semibold leading-none">
                  {cell.amount > 0 ? formatILS(cell.amount) : '—'}
                </div>
                <div
                  className="mt-2 h-1 rounded-full"
                  style={{ background: 'var(--surface-sunken)' }}
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(share * 100)}%`, background: toneOf(b) }}
                  />
                </div>
                <div className="mt-1.5 text-[0.72rem] text-secondary">
                  {cell.count > 0 ? `${cell.count} חשבוניות` : 'ריק'}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── החשבוניות ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">
            {bucket ? BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS] ?? 'חשבוניות' : 'חשבוניות פתוחות'}
            <span className="tnum ms-2 text-[0.8rem] text-muted">({shown.length})</span>
          </h2>
          {bucket ? (
            <Link href="/billing" className="text-[0.8rem] text-secondary hover:underline">
              הצג הכול
            </Link>
          ) : null}
        </header>

        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-[0.88rem] text-muted">אין חשבוניות פתוחות בקטגוריה הזו.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-[0.85rem]">
              <thead>
                <tr className="border-b border-hairline text-[0.72rem] text-muted">
                  <th className="px-4 py-2 text-start font-normal">חשבונית</th>
                  <th className="px-4 py-2 text-start font-normal">לקוח</th>
                  <th className="px-4 py-2 text-start font-normal">נושא</th>
                  <th className="px-4 py-2 text-end font-normal">סכום</th>
                  <th className="px-4 py-2 text-end font-normal">יתרה</th>
                  <th className="px-4 py-2 text-start font-normal">מועד</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {shown.map((invoice) => {
                  const balance = openBalance(invoice);
                  const late = daysOverdue(invoice);
                  const partial = balance > 0 && balance < toAgorot(invoice.amount);
                  return (
                    <tr key={invoice.id} className="hover:bg-sunken">
                      <td className="whitespace-nowrap px-4 py-2.5 tnum">{invoice.number}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/customers/${invoice.customer_id}`} className="hover:underline">
                          {invoice.customer_name}
                        </Link>
                      </td>
                      <td className="max-w-64 truncate px-4 py-2.5 text-secondary">{invoice.subject ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end tnum text-secondary">
                        {formatILS(toAgorot(invoice.amount))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end tnum font-medium">
                        {formatILS(balance)}
                        {partial ? (
                          <span className="ms-1.5 text-[0.68rem] font-normal text-muted">חלקי</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {late > 0 ? (
                          <StatusPill tone={late > 60 ? 'danger' : 'warning'}>{late} יום באיחור</StatusPill>
                        ) : (
                          <span className="text-[0.78rem] text-muted">{formatDate(invoice.due_on)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── תקבולים ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">נכנס החודש</h2>
        </header>
        {payments.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.88rem] text-muted">עוד לא נכנסו תקבולים החודש.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {payments.slice(0, 12).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.85rem]">
                <span className="w-20 shrink-0 text-[0.76rem] text-muted">{formatDate(p.received_on)}</span>
                <Link href={`/customers/${p.customer_id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {p.customer_name}
                </Link>
                <span className="shrink-0 text-[0.72rem] text-muted">{methodLabel(p.method)}</span>
                <span className="shrink-0 tnum font-medium" style={{ color: 'var(--positive)' }}>
                  {formatILS(toAgorot(p.amount))} ₪
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const METHODS: Record<string, string> = {
  transfer: 'העברה', check: 'צ׳ק', card: 'אשראי', cash: 'מזומן',
  standing_order: 'הוראת קבע', other: 'אחר',
};
const methodLabel = (m: string) => METHODS[m] ?? m;

function toneOf(bucket: string): string {
  if (bucket === 'current') return 'var(--positive)';
  if (bucket === 'd1_30') return 'var(--accent)';
  if (bucket === 'd90_plus') return 'var(--danger)';
  return 'var(--warning)';
}

function headline(book: ReturnType<typeof aging>): string {
  if (book.total === 0) return 'אין חשבוניות פתוחות. הכול נגבה.';
  if (book.overdue === 0) return 'הכול בתוך תנאי התשלום — אין מה לגבות היום.';
  const share = Math.round((book.overdue / book.total) * 100);
  return `${share}% מהחוב הפתוח כבר עבר את מועד התשלום.`;
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
