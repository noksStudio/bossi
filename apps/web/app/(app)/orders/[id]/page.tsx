import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrincipal, customerBalances, getOrder, orderLines } from '@bossi/db';
import { GATE_LABELS, formatILS, orderGate, orderTotals, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הזמנה' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const order = await asPrincipal(principal, (tx) => getOrder(tx, id));
  if (!order) notFound();

  const [lines, balances] = await Promise.all([
    asPrincipal(principal, (tx) => orderLines(tx, id)),
    asPrincipal(principal, (tx) => customerBalances(tx, order.customer_id)),
  ]);

  const totals = orderTotals(lines);
  const balance = balances[0];
  const gate = orderGate({
    orderGross: totals.gross,
    openBalance: toAgorot(balance?.open_amount ?? 0),
    overdueBalance: toAgorot(balance?.overdue_amount ?? 0),
    creditLimit: order.credit_limit ? toAgorot(order.credit_limit) : null,
    linesShort: order.short_lines,
  });

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-2 text-[0.78rem] text-muted">
          <Link href="/orders" className="hover:underline">הזמנות</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[1.6rem] tnum">{order.number}</h1>
          <StatusPill tone={order.status === 'rejected' ? 'danger' : order.status === 'pending' ? 'warning' : 'positive'}>
            {STATUS_LABELS[order.status] ?? order.status}
          </StatusPill>
        </div>
        <p className="mt-1 text-[0.88rem] text-muted">
          <Link href={`/customers/${order.customer_id}`} className="hover:underline">{order.customer_name}</Link>
          {order.placed_by ? ` · ${order.placed_by}` : ''} · {CHANNELS[order.channel] ?? order.channel}
        </p>
      </div>

      {order.status === 'pending' ? (
        <div
          className="rounded-lg border p-4"
          style={
            gate.gate === 'approve'
              ? { borderColor: 'var(--positive)', background: 'var(--positive-quiet)' }
              : { borderColor: 'var(--warning)', background: 'var(--warning-quiet)' }
          }
        >
          <h2 className="text-[0.95rem] font-medium" style={{ color: gate.gate === 'approve' ? 'var(--positive)' : 'var(--warning)' }}>
            {GATE_LABELS[gate.gate]}
          </h2>
          <p className="mt-1 text-[0.84rem] text-secondary">
            {gate.detail || 'אין חסם — מסגרת האשראי פנויה, אין חוב באיחור וכל השורות במלאי.'}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.78rem]">
            <div>
              <dt className="inline text-muted">יתרה פתוחה: </dt>
              <dd className="inline tnum">{formatILS(toAgorot(balance?.open_amount ?? 0))} ₪</dd>
            </div>
            <div>
              <dt className="inline text-muted">מתוכה באיחור: </dt>
              <dd className="inline tnum">{formatILS(toAgorot(balance?.overdue_amount ?? 0))} ₪</dd>
            </div>
            <div>
              <dt className="inline text-muted">מסגרת אשראי: </dt>
              <dd className="inline tnum">
                {order.credit_limit ? `${formatILS(toAgorot(order.credit_limit))} ₪` : 'ללא'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">שורות ההזמנה</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">המחיר מוקפא בזמן ההזמנה — שינוי מחירון לא משנה הזמנה קיימת</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-[0.85rem]">
            <thead>
              <tr className="border-b border-hairline text-[0.72rem] text-muted">
                <th className="px-4 py-2 text-start font-normal">פריט</th>
                <th className="px-4 py-2 text-end font-normal">כמות</th>
                <th className="px-4 py-2 text-end font-normal">זמין</th>
                <th className="px-4 py-2 text-end font-normal">מחיר</th>
                <th className="px-4 py-2 text-end font-normal">סה״כ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {lines.map((l) => {
                const short = Number(l.quantity) > Number(l.available);
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5">
                      <div>{l.name}</div>
                      <div className="tnum text-[0.7rem] text-muted" dir="ltr">{l.sku}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end tnum">{Number(l.quantity).toLocaleString('he-IL')}</td>
                    <td
                      className="whitespace-nowrap px-4 py-2.5 text-end tnum"
                      style={short ? { color: 'var(--danger)' } : { color: 'var(--text-muted)' }}
                    >
                      {Number(l.available).toLocaleString('he-IL')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end tnum text-secondary">
                      {formatILS(toAgorot(l.unit_price), { decimals: true })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end tnum font-medium">
                      {formatILS(toAgorot(l.line_total))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-hairline text-[0.85rem]">
              <tr>
                <td className="px-4 py-2 text-muted" colSpan={4}>סה״כ לפני מע״מ</td>
                <td className="px-4 py-2 text-end tnum">{formatILS(totals.net)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-muted" colSpan={4}>מע״מ 18%</td>
                <td className="px-4 py-2 text-end tnum">{formatILS(totals.vat)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium" colSpan={4}>לתשלום</td>
                <td className="px-4 py-2.5 text-end tnum font-semibold">{formatILS(totals.gross)} ₪</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה', pending: 'ממתינה', approved: 'אושרה',
  shipped: 'נשלחה', rejected: 'נדחתה', cancelled: 'בוטלה',
};
const CHANNELS: Record<string, string> = {
  portal: 'מהפורטל', phone: 'בטלפון', email: 'במייל', whatsapp: 'ב-WhatsApp', rep: 'על ידי נציג',
};
