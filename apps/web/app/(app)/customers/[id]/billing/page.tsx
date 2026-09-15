import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  asPrincipal, customerBalances, getCustomerDetail, listInvoices, listPayments,
} from '@bossi/db';
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
  return { title: `כספים · ${customer?.display_name ?? 'לקוח'}` };
}

/**
 * יתרה, חשבוניות ותקבולים של לקוח אחד — תור הגבייה מלמעלה מוצא את
 * מי לטפל בו קודם, המסך הזה עונה על "כמה בדיוק הלקוח הזה חייב ולמה".
 * בלי המסך הזה `billing.tab` היה קישור מעומעם שמוביל לשום מקום —
 * בדיוק מה שהיה קורה עד עכשיו (ראה ADR-028).
 */
export default async function CustomerBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const [customer, shell] = await Promise.all([
    asPrincipal(principal, (tx) => getCustomerDetail(tx, id)),
    loadShell(principal),
  ]);
  if (!customer) notFound();

  const [balances, invoices, payments] = await Promise.all([
    asPrincipal(principal, (tx) => customerBalances(tx, id)),
    asPrincipal(principal, (tx) => listInvoices(tx, { customerId: id })),
    asPrincipal(principal, (tx) => listPayments(tx, { customerId: id })),
  ]);
  const balance = balances[0];

  return (
    <div className="space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/customers" className="hover:text-primary">לקוחות</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <Link href={`/customers/${id}`} className="hover:text-primary">{customer.display_name}</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>כספים</span>
      </nav>

      <h1 className="text-[1.5rem]">{customer.display_name} · כספים</h1>

      <CustomerTabs tabs={customerTabs(shell.slots('customer.tabs'), id)} customerId={id} active="billing.tab" />

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <Tile label="יתרה פתוחה" value={`${formatILS(toAgorot(balance?.open_amount ?? '0'))} ₪`} tone={Number(balance?.open_amount ?? 0) > 0 ? 'warning' : undefined} />
        <Tile label="מתוכה באיחור" value={`${formatILS(toAgorot(balance?.overdue_amount ?? '0'))} ₪`} tone={Number(balance?.overdue_amount ?? 0) > 0 ? 'danger' : undefined} />
        <Tile label="חשבוניות פתוחות" value={String(balance?.open_count ?? 0)} />
        <Tile label="מסגרת אשראי" value={customer.credit_limit ? `${formatILS(toAgorot(customer.credit_limit))} ₪` : 'ללא'} />
      </div>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline bg-sunken px-4 py-2.5">
          <h2 className="text-[0.85rem]">חשבוניות</h2>
        </header>
        {invoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.82rem] text-muted">אין חשבוניות ללקוח הזה.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {invoices.map((inv) => {
              const open = Number(inv.amount) - Number(inv.paid_amount);
              const overdue = open > 0.005 && new Date(inv.due_on) < new Date();
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.85rem]">
                  <span className="w-16 shrink-0 tnum">{inv.number}</span>
                  <span className="min-w-0 flex-1 truncate text-secondary">{inv.subject ?? '—'}</span>
                  <span className="shrink-0 text-[0.76rem] text-muted">לתשלום {new Date(inv.due_on).toLocaleDateString('he-IL')}</span>
                  {overdue ? <StatusPill tone="danger">באיחור</StatusPill> : inv.status === 'paid' ? <StatusPill tone="positive">שולם</StatusPill> : null}
                  <span className="w-24 shrink-0 text-end tnum">{formatILS(toAgorot(inv.amount))} ₪</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline bg-sunken px-4 py-2.5">
          <h2 className="text-[0.85rem]">תקבולים</h2>
        </header>
        {payments.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.82rem] text-muted">אין תקבולים ללקוח הזה.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.85rem]">
                <span className="shrink-0 text-[0.76rem] text-muted">{new Date(p.received_on).toLocaleDateString('he-IL')}</span>
                <span className="min-w-0 flex-1 truncate text-secondary">{METHOD_LABELS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                <span className="w-24 shrink-0 text-end tnum">{formatILS(toAgorot(p.amount))} ₪</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  transfer: 'העברה בנקאית', check: 'צ׳ק', card: 'כרטיס אשראי', cash: 'מזומן',
};

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) {
  const color = tone ? `var(--${tone})` : undefined;
  return (
    <div className="px-4 py-3.5">
      <div className="text-[0.72rem] text-muted">{label}</div>
      <div className="mt-1 text-[1.4rem] font-semibold leading-none" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
