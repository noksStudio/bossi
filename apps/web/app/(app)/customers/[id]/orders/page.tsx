import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrincipal, getCustomerDetail, listOrders } from '@bossi/db';
import { formatILS, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { loadShell } from '@/lib/navigation';
import { customerTabs } from '@/lib/customer-tabs';
import { CustomerTabs } from '@/components/app/customer-tabs';
import { StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const customer = await asPrincipal(principal, (tx) => getCustomerDetail(tx, id));
  return { title: `הזמנות · ${customer?.display_name ?? 'לקוח'}` };
}

/** היסטוריית ההזמנות של לקוח אחד. משלים את `orders.tab` שעד עכשיו הוביל לשום מקום. */
export default async function CustomerOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const [customer, shell] = await Promise.all([
    asPrincipal(principal, (tx) => getCustomerDetail(tx, id)),
    loadShell(principal),
  ]);
  if (!customer) notFound();

  const orders = await asPrincipal(principal, (tx) => listOrders(tx, { customerId: id, limit: 200 }));

  return (
    <div className="space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/customers" className="hover:text-primary">לקוחות</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <Link href={`/customers/${id}`} className="hover:text-primary">{customer.display_name}</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>הזמנות</span>
      </nav>

      <h1 className="text-[1.5rem]">{customer.display_name} · הזמנות</h1>

      <CustomerTabs tabs={customerTabs(shell.slots('customer.tabs'), id)} customerId={id} active="orders.tab" />

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">אין הזמנות ללקוח הזה</h2>
          <Link href="/orders/new" className="mt-2 inline-block text-[0.85rem] hover:underline" style={{ color: 'var(--accent)' }}>
            יצירת הזמנה חדשה ←
          </Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline">
          <ul className="divide-y divide-hairline">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[0.85rem] transition-colors hover:bg-sunken"
                >
                  <span className="w-20 shrink-0 tnum">{o.number}</span>
                  <span className="min-w-0 flex-1 text-secondary">{o.line_count} שורות</span>
                  <span className="shrink-0 text-[0.76rem] text-muted">{new Date(o.placed_at).toLocaleDateString('he-IL')}</span>
                  <StatusPill tone={o.status === 'rejected' ? 'danger' : o.status === 'pending' ? 'warning' : 'positive'}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </StatusPill>
                  <span className="w-24 shrink-0 text-end tnum">{formatILS(toAgorot(o.net_total))} ₪</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה', pending: 'ממתינה', approved: 'אושרה',
  shipped: 'נשלחה', rejected: 'נדחתה', cancelled: 'בוטלה',
};
