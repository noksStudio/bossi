import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  approveOrder, asPrincipal, customerBalances, listOrders, publishEvent, rejectOrder,
} from '@bossi/db';
import { GATE_LABELS, can, formatILS, orderGate, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הזמנות' };

/**
 * הזמנות שממתינות להחלטה.
 *
 * לצד כל הזמנה מוצג **שער האישור**: מסגרת אשראי, חוב באיחור, מלאי זמין.
 * זה מה שמפריד בין "אשר" ללחיצה עיוורת — ההחלטה נשארת של בעל העסק,
 * אבל היא מתקבלת מול המספרים ולא מולם.
 */
export default async function OrdersPage() {
  const principal = await requirePrincipal();
  const canApprove = can(principal.role, 'orders.approve');

  const [orders, balances] = await Promise.all([
    asPrincipal(principal, (tx) => listOrders(tx, { limit: 60 })),
    asPrincipal(principal, (tx) => customerBalances(tx)),
  ]);

  const balanceOf = new Map(balances.map((b) => [b.customer_id, b]));
  const decorate = (o: (typeof orders)[number]) => {
    const balance = balanceOf.get(o.customer_id);
    return {
      ...o,
      gate: orderGate({
        orderGross: Math.round(toAgorot(o.net_total) * 1.18),
        openBalance: toAgorot(balance?.open_amount ?? 0),
        overdueBalance: toAgorot(balance?.overdue_amount ?? 0),
        creditLimit: o.credit_limit ? toAgorot(o.credit_limit) : null,
        linesShort: o.short_lines,
      }),
      overdue: toAgorot(balance?.overdue_amount ?? 0),
    };
  };

  const pending = orders.filter((o) => o.status === 'pending').map(decorate);
  const recent = orders.filter((o) => o.status !== 'pending').slice(0, 15);
  const blocked = pending.filter((o) => o.gate.gate !== 'approve');

  async function approve(orderId: string) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'orders.approve')) throw new Error('אין הרשאה לאשר הזמנות');
    await asPrincipal(principal, async (tx) => {
      // האישור וההקצאה קורים באותה טרנזקציה — אחרת אותו פריט מובטח פעמיים.
      if (await approveOrder(tx, orderId)) {
        await publishEvent(tx, {
          type: 'orders.approved', actorType: 'user', actorId: principal.userId,
          subjectType: 'order', subjectId: orderId, payload: {},
        });
      }
    });
    revalidatePath('/orders');
  }

  async function reject(orderId: string, formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'orders.approve')) throw new Error('אין הרשאה לדחות הזמנות');
    const reason = String(formData.get('reason') ?? 'נדחה ידנית');
    await asPrincipal(principal, async (tx) => {
      if (await rejectOrder(tx, orderId, reason)) {
        await publishEvent(tx, {
          type: 'orders.rejected', actorType: 'user', actorId: principal.userId,
          subjectType: 'order', subjectId: orderId, payload: { reason },
        });
      }
    });
    revalidatePath('/orders');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">הזמנות</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {pending.length === 0
            ? 'אין הזמנות שממתינות להחלטה.'
            : `${pending.length} ממתינות · ${blocked.length} נעצרו בשער האישור`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="ממתינות" value={String(pending.length)} />
        <StatTile
          label="שווי ממתין"
          value={`${formatILS(pending.reduce((s, o) => s + toAgorot(o.net_total), 0))} ₪`}
          note="לפני מע״מ"
        />
        <StatTile label="נעצרו" value={String(blocked.length)} note={blocked.length ? 'דורש החלטה' : 'הכול עובר'} />
        <StatTile label="אושרו והוזמנו" value={String(orders.filter((o) => o.status !== 'pending').length)} note="30 יום אחרונים" />
      </div>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">
            ממתינות להחלטה <span className="tnum text-[0.8rem] text-muted">({pending.length})</span>
          </h2>
        </header>

        {pending.length === 0 ? (
          <p className="px-4 py-10 text-center text-[0.88rem] text-muted">אין הזמנות פתוחות.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/orders/${o.id}`} className="text-[0.92rem] font-medium hover:underline">
                      {o.number}
                    </Link>
                    <Link href={`/customers/${o.customer_id}`} className="text-[0.88rem] text-secondary hover:underline">
                      {o.customer_name}
                    </Link>
                    <StatusPill tone={o.gate.gate === 'approve' ? 'positive' : 'warning'}>
                      {GATE_LABELS[o.gate.gate]}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-[0.78rem] text-secondary">
                    {o.gate.detail || `${o.line_count} שורות · הוזמן ${channelLabel(o.channel)}${o.placed_by ? ` על ידי ${o.placed_by}` : ''}`}
                  </p>
                </div>

                <div className="shrink-0 text-end">
                  <div className="tnum text-[1.05rem] font-semibold leading-none">{formatILS(toAgorot(o.net_total))} ₪</div>
                  <div className="mt-1 text-[0.72rem] text-muted">{relative(o.placed_at)}</div>
                </div>

                {canApprove ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <form action={approve.bind(null, o.id)}>
                      <button
                        type="submit"
                        className="rounded-sm px-3 py-1.5 text-[0.78rem] font-medium transition-opacity hover:opacity-90"
                        style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
                      >
                        אשר
                      </button>
                    </form>
                    <form action={reject.bind(null, o.id)}>
                      <input type="hidden" name="reason" value="נדחה מהמסך" />
                      <button
                        type="submit"
                        className="rounded-sm border border-strong px-3 py-1.5 text-[0.78rem] text-secondary transition-colors hover:bg-sunken"
                      >
                        דחה
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">היסטוריה</h2>
          </header>
          <ul className="divide-y divide-hairline">
            {recent.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.85rem]">
                <Link href={`/orders/${o.id}`} className="w-20 shrink-0 tnum hover:underline">
                  {o.number}
                </Link>
                <Link href={`/customers/${o.customer_id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {o.customer_name}
                </Link>
                <StatusPill tone={o.status === 'rejected' ? 'danger' : o.status === 'shipped' ? 'neutral' : 'positive'}>
                  {STATUS_LABELS[o.status] ?? o.status}
                </StatusPill>
                <span className="w-24 shrink-0 text-end tnum text-secondary">{formatILS(toAgorot(o.net_total))} ₪</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
const channelLabel = (c: string) => CHANNELS[c] ?? c;

function relative(at: Date | string): string {
  const hours = Math.round((Date.now() - new Date(at).getTime()) / 3_600_000);
  if (hours < 1) return 'הרגע';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
}
