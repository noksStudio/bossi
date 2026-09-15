'use client';

import { useId, useState } from 'react';

export interface OrderProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  list_price: string;
}

/**
 * שורות הזמנה דינמיות — הוספה/הסרה בצד לקוח, אבל השליחה עצמה עדיין
 * `<form action={server action}>` רגיל (לא fetch), כמו כל שאר טפסי
 * היצירה באפליקציה. `rowKeys` מעביר לשרת אילו אינדקסים באמת קיימים,
 * כי הסרת שורה אמצעית משאירה פער במספור.
 *
 * בחירת מוצר מהקטלוג ממלאת שם/מק״ט/מחיר אוטומטית — עדיין ניתנים
 * לעריכה, כי "עבודה מותאמת" בלי מוצר קטלוגי היא מקרה לגיטימי (בית
 * מלאכה לא תמיד עובד מול קטלוג קבוע).
 */
export function OrderLineRows({ products }: { products: OrderProductOption[] }) {
  const uid = useId();
  const [rows, setRows] = useState<number[]>([0]);
  const [nextKey, setNextKey] = useState(1);

  return (
    <div className="space-y-3">
      <input type="hidden" name="rowKeys" value={JSON.stringify(rows)} />
      {rows.map((key) => (
        <OrderLineRow
          key={key}
          uid={uid}
          rowKey={key}
          products={products}
          onRemove={rows.length > 1 ? () => setRows((r) => r.filter((k) => k !== key)) : undefined}
        />
      ))}
      <button
        type="button"
        onClick={() => { setRows((r) => [...r, nextKey]); setNextKey((n) => n + 1); }}
        className="rounded-md border border-dashed border-strong px-3 py-1.5 text-[0.82rem] text-secondary hover:bg-sunken"
      >
        + הוספת שורה
      </button>
    </div>
  );
}

function OrderLineRow({
  uid, rowKey, products, onRemove,
}: { uid: string; rowKey: number; products: OrderProductOption[]; onRemove?: () => void }) {
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) { setName(p.name); setSku(p.sku); setPrice(p.list_price); }
  }

  const f = (field: string) => `${field}-${rowKey}`;

  return (
    <div className="grid gap-2 rounded-lg border border-hairline p-3 sm:grid-cols-6">
      <label className="sm:col-span-2">
        <span className="text-[0.72rem] text-muted">מוצר</span>
        <select
          name={f('productId')} value={productId} onChange={(e) => pickProduct(e.target.value)}
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        >
          <option value="">מוצר מותאם (הזנה ידנית)</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <label>
        <span className="text-[0.72rem] text-muted">שם</span>
        <input
          name={f('name')} value={name} onChange={(e) => setName(e.target.value)} required
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        />
      </label>

      <label>
        <span className="text-[0.72rem] text-muted">מק״ט</span>
        <input
          name={f('sku')} value={sku} onChange={(e) => setSku(e.target.value)} dir="ltr"
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        />
      </label>

      <label>
        <span className="text-[0.72rem] text-muted">כמות</span>
        <input
          name={f('quantity')} type="number" min="0.01" step="0.01" defaultValue="1" required dir="ltr"
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        />
      </label>

      <label>
        <span className="text-[0.72rem] text-muted">מחיר יח׳</span>
        <input
          name={f('unitPrice')} type="number" min="0" step="0.01" value={price}
          onChange={(e) => setPrice(e.target.value)} required dir="ltr"
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        />
      </label>

      <label>
        <span className="text-[0.72rem] text-muted">צבע</span>
        <input
          name={f('color')} list={`${uid}-colors`}
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        />
      </label>

      <label>
        <span className="text-[0.72rem] text-muted">סוג עבודה</span>
        <input
          name={f('jobType')} list={`${uid}-job-types`}
          className="mt-0.5 w-full rounded-md border border-strong bg-raised px-2 py-1.5 text-[0.85rem] outline-none"
        />
      </label>

      {onRemove ? (
        <button
          type="button" onClick={onRemove}
          className="justify-self-start text-[0.78rem] text-muted hover:text-primary sm:col-span-6"
        >
          הסרת שורה
        </button>
      ) : null}

      <datalist id={`${uid}-colors`}>
        <option value="לבן" /><option value="שחור" /><option value="כחול" /><option value="אדום" /><option value="ירוק" />
      </datalist>
      <datalist id={`${uid}-job-types`}>
        <option value="הדפסה" /><option value="גזירה" /><option value="תפירה" /><option value="גימור" />
      </datalist>
    </div>
  );
}
