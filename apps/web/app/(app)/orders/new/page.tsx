import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  asPrincipal, createOrder, listCustomers, listProducts, nextOrderNumber, publishEvent,
} from '@bossi/db';
import { can } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { OrderLineRows } from '@/components/app/order-line-rows';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הזמנה חדשה' };

/**
 * "כפתור הזמנה חדשה": בחירת לקוח מציגה מיד את הח״פ שלו — מוטמע בתוך
 * הרשימה עצמה, בלי שדה נפרד שצריך "למשוך" אליו — ושורות ההזמנה כוללות
 * צבע/סוג עבודה שהמשרד קובע כאן, לא ברצפת הייצור.
 *
 * ההזמנה נוצרת כ-`pending` בכוונה, גם כשהמשרד עצמו יוצר אותה: שער
 * האישור (מסגרת אשראי, חוב באיחור) שכבר קיים ב-`/orders` הוא בדיוק
 * מה שמונע התחלת עבודה עבור לקוח שחייב כסף — ולכן שווה לעבור דרכו
 * גם כשההזמנה לא הגיעה מהלקוח עצמו.
 */
export default async function NewOrderPage() {
  const principal = await requirePrincipal();

  const [customers, products] = await Promise.all([
    asPrincipal(principal, (tx) => listCustomers(tx, { status: 'active', limit: 500 })),
    asPrincipal(principal, (tx) => listProducts(tx, { status: 'active' })),
  ]);

  async function create(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'orders.write', principal.overrides)) throw new Error('אין הרשאה ליצור הזמנות');

    const customerId = String(formData.get('customerId') ?? '');
    if (!customerId) redirect('/orders/new?error=1');
    const neededBy = str(formData.get('neededBy'));

    const rowKeys: number[] = JSON.parse(String(formData.get('rowKeys') ?? '[]'));
    const lines = rowKeys
      .map((key) => ({
        productId: str(formData.get(`productId-${key}`)),
        sku: String(formData.get(`sku-${key}`) ?? '').trim(),
        name: String(formData.get(`name-${key}`) ?? '').trim(),
        quantity: String(formData.get(`quantity-${key}`) ?? ''),
        unitPrice: String(formData.get(`unitPrice-${key}`) ?? ''),
        color: str(formData.get(`color-${key}`)),
        jobType: str(formData.get(`jobType-${key}`)),
      }))
      .filter((l) => l.name && Number(l.quantity) > 0);
    if (lines.length === 0) redirect('/orders/new?error=1');

    const orderId = await asPrincipal(principal, async (tx) => {
      const number = await nextOrderNumber(tx);
      const id = await createOrder(tx, {
        customerId, number, channel: 'rep', placedBy: principal.name, neededBy, lines,
      });
      await publishEvent(tx, {
        type: 'orders.placed', actorType: 'user', actorId: principal.userId,
        customerId, subjectType: 'order', subjectId: id, payload: { number },
      });
      return id;
    });

    redirect(`/orders/${orderId}`);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/orders" className="hover:text-primary">הזמנות</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>חדשה</span>
      </nav>

      <h1 className="text-[1.6rem]">הזמנה חדשה</h1>

      {!can(principal.role, 'orders.write', principal.overrides) ? (
        <p className="text-[0.88rem] text-muted">אין לך הרשאה ליצור הזמנות.</p>
      ) : customers.length === 0 ? (
        <p className="text-[0.88rem] text-muted">אין לקוחות פעילים — יש להוסיף לקוח לפני יצירת הזמנה.</p>
      ) : (
        <form action={create} className="space-y-5">
          <CustomerField customers={customers} />

          <label className="block max-w-xs">
            <span className="text-[0.85rem] font-medium">דרוש עד</span>
            <input
              name="neededBy" type="date"
              className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
            />
          </label>

          <div>
            <span className="text-[0.85rem] font-medium">שורות ההזמנה</span>
            <div className="mt-1.5">
              <OrderLineRows products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, list_price: p.list_price }))} />
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="submit"
              className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              יצירת הזמנה
            </button>
            <Link href="/orders" className="rounded-md border border-strong px-4 py-2.5 text-[0.9rem]">ביטול</Link>
          </div>
        </form>
      )}
    </div>
  );
}

function CustomerField({ customers }: { customers: Array<{ id: string; display_name: string; business_id: string | null }> }) {
  return (
    <label className="block max-w-md">
      <span className="text-[0.85rem] font-medium">לקוח</span>
      <select
        name="customerId" required defaultValue=""
        className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
      >
        <option value="" disabled>בחירת לקוח</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name}{c.business_id ? ` · ח״פ ${c.business_id}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function str(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? '').trim();
  return s.length > 0 ? s : null;
}
