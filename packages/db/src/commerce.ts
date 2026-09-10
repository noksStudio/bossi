import type { Tx } from './client';

/** קטלוג, מלאי והזמנות. */

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  list_price: string;
  cost_price: string | null;
  status: string;
  on_hand: string;
  allocated: string;
  reorder_point: string;
  lead_days: number;
  /** כמה לקוחות יש להם מחיר משלהם. "כמה חורים יש במחירון." */
  custom_prices: number;
}

const PRODUCT_SELECT = `
  select p.id, p.sku, p.name, p.description, p.category, p.unit,
         p.list_price::text, p.cost_price::text, p.status,
         coalesce(i.on_hand, 0)::text       as on_hand,
         coalesce(i.allocated, 0)::text     as allocated,
         coalesce(i.reorder_point, 0)::text as reorder_point,
         coalesce(i.lead_days, 0)           as lead_days,
         (select count(*) from customer_prices cp where cp.product_id = p.id)::text as custom_prices
    from products p
    left join inventory_levels i on i.product_id = p.id and i.location = 'ראשי'
`;

export async function listProducts(
  tx: Tx,
  f: { category?: string; query?: string; status?: string } = {},
): Promise<ProductRow[]> {
  const { rows } = await tx.query<ProductRow & { custom_prices: string }>(
    `${PRODUCT_SELECT}
      where ($1::text is null or p.category = $1)
        and ($2::text is null or p.name ilike '%' || $2 || '%' or p.sku ilike '%' || $2 || '%')
        and ($3::text is null or p.status = $3)
      order by p.category nulls last, p.name`,
    [f.category ?? null, f.query ?? null, f.status ?? null],
  );
  return rows.map((r) => ({ ...r, custom_prices: Number(r.custom_prices) }));
}

export async function productCategories(tx: Tx): Promise<Array<{ category: string; count: number }>> {
  const { rows } = await tx.query<{ category: string; count: string }>(
    `select coalesce(category, 'ללא קטגוריה') as category, count(*)::text
       from products where status = 'active' group by 1 order by 1`,
  );
  return rows.map((r) => ({ category: r.category, count: Number(r.count) }));
}

export interface CustomerPriceRow {
  id: string;
  customer_id: string;
  customer_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  list_price: string;
  price: string;
  min_quantity: number;
  valid_until: Date | null;
}

export async function listCustomerPrices(tx: Tx, f: { customerId?: string; productId?: string } = {}): Promise<CustomerPriceRow[]> {
  const { rows } = await tx.query<CustomerPriceRow & { min_quantity: string }>(
    `select cp.id, cp.customer_id, c.display_name as customer_name, cp.product_id,
            p.sku, p.name as product_name, p.list_price::text, cp.price::text,
            cp.min_quantity::text, cp.valid_until
       from customer_prices cp
       join customers c on c.id = cp.customer_id
       join products p on p.id = cp.product_id
      where ($1::uuid is null or cp.customer_id = $1)
        and ($2::uuid is null or cp.product_id = $2)
      order by c.display_name, p.name`,
    [f.customerId ?? null, f.productId ?? null],
  );
  return rows.map((r) => ({ ...r, min_quantity: Number(r.min_quantity) }));
}

// ── הזמנות ────────────────────────────────────────────────────────────────

export interface OrderRow {
  id: string;
  customer_id: string;
  customer_name: string;
  credit_limit: string | null;
  number: string;
  placed_at: Date;
  placed_by: string | null;
  channel: string;
  status: string;
  needed_by: Date | null;
  hold_reason: string | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  line_count: number;
  net_total: string;
  /** שורות שאין להן מלאי זמין מספיק ברגע זה. */
  short_lines: number;
}

const ORDER_SELECT = `
  select o.id, o.customer_id, c.display_name as customer_name, c.credit_limit::text,
         o.number, o.placed_at, o.placed_by, o.channel, o.status, o.needed_by,
         o.hold_reason, u.name as approved_by_name, o.approved_at,
         (select count(*) from order_lines l where l.order_id = o.id)::text as line_count,
         coalesce((select sum(l.line_total) from order_lines l where l.order_id = o.id), 0)::text as net_total,
         (select count(*) from order_lines l
            left join inventory_levels inv on inv.product_id = l.product_id and inv.location = 'ראשי'
           where l.order_id = o.id
             and l.quantity > coalesce(inv.on_hand, 0) - coalesce(inv.allocated, 0))::text as short_lines
    from orders o
    join customers c on c.id = o.customer_id
    left join users u on u.id = o.approved_by
`;

export async function listOrders(
  tx: Tx,
  f: { status?: string; customerId?: string; limit?: number } = {},
): Promise<OrderRow[]> {
  const { rows } = await tx.query<OrderRow & { line_count: string; short_lines: string }>(
    `${ORDER_SELECT}
      where ($1::text is null or o.status = $1)
        and ($2::uuid is null or o.customer_id = $2)
      order by
        case o.status when 'pending' then 0 when 'approved' then 1 else 2 end,
        o.placed_at desc
      limit $3`,
    [f.status ?? null, f.customerId ?? null, f.limit ?? 100],
  );
  return rows.map((r) => ({ ...r, line_count: Number(r.line_count), short_lines: Number(r.short_lines) }));
}

export async function getOrder(tx: Tx, id: string): Promise<OrderRow | null> {
  const { rows } = await tx.query<OrderRow & { line_count: string; short_lines: string }>(
    `${ORDER_SELECT} where o.id = $1`, [id],
  );
  const row = rows[0];
  return row ? { ...row, line_count: Number(row.line_count), short_lines: Number(row.short_lines) } : null;
}

export interface OrderLineRow {
  id: string;
  product_id: string | null;
  sku: string;
  name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  available: string;
}

export async function orderLines(tx: Tx, orderId: string): Promise<OrderLineRow[]> {
  const { rows } = await tx.query<OrderLineRow>(
    `select l.id, l.product_id, l.sku, l.name, l.quantity::text,
            l.unit_price::text, l.line_total::text,
            (coalesce(i.on_hand, 0) - coalesce(i.allocated, 0))::text as available
       from order_lines l
       left join inventory_levels i on i.product_id = l.product_id and i.location = 'ראשי'
      where l.order_id = $1
      order by l.name`,
    [orderId],
  );
  return rows;
}

export async function createProduct(
  tx: Tx,
  input: { sku: string; name: string; listPrice: string; category?: string | null; unit?: string | null; description?: string | null; costPrice?: string | null },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into products (tenant_id, sku, name, list_price, category, unit, description, cost_price)
     values (current_tenant(), $1, $2, $3, $4, coalesce($5, 'יח׳'), $6, $7) returning id`,
    [input.sku, input.name, input.listPrice, input.category ?? null,
     input.unit ?? null, input.description ?? null, input.costPrice ?? null],
  );
  return rows[0]!.id;
}

export async function setStock(
  tx: Tx,
  input: { productId: string; onHand: string; allocated?: string; reorderPoint?: string; leadDays?: number; location?: string },
): Promise<void> {
  await tx.query(
    `insert into inventory_levels (tenant_id, product_id, location, on_hand, allocated, reorder_point, lead_days, synced_at)
     values (current_tenant(), $1, coalesce($2, 'ראשי'), $3, coalesce($4::numeric, 0), coalesce($5::numeric, 0), coalesce($6, 7), now())
     on conflict (tenant_id, product_id, location) do update
       set on_hand = excluded.on_hand, allocated = excluded.allocated,
           reorder_point = excluded.reorder_point, lead_days = excluded.lead_days,
           synced_at = now()`,
    [input.productId, input.location ?? null, input.onHand, input.allocated ?? null,
     input.reorderPoint ?? null, input.leadDays ?? null],
  );
}

export async function createOrder(
  tx: Tx,
  input: {
    customerId: string; number: string; channel?: string; status?: string;
    placedAt?: Date; placedBy?: string | null; neededBy?: string | null; holdReason?: string | null;
    lines: Array<{ productId: string; sku: string; name: string; quantity: string; unitPrice: string }>;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into orders (tenant_id, customer_id, number, channel, status, placed_at, placed_by, needed_by, hold_reason)
     values (current_tenant(), $1, $2, coalesce($3, 'portal'), coalesce($4, 'pending'),
             coalesce($5::timestamptz, now()), $6, $7::date, $8)
     returning id`,
    [input.customerId, input.number, input.channel ?? null, input.status ?? null,
     input.placedAt ?? null, input.placedBy ?? null, input.neededBy ?? null, input.holdReason ?? null],
  );
  const orderId = rows[0]!.id;

  for (const l of input.lines) {
    await tx.query(
      `insert into order_lines (tenant_id, order_id, product_id, sku, name, quantity, unit_price, line_total)
       values (current_tenant(), $1, $2, $3, $4, $5, $6, round($5::numeric * $6::numeric, 2))`,
      [orderId, l.productId, l.sku, l.name, l.quantity, l.unitPrice],
    );
  }
  return orderId;
}

/**
 * אישור הזמנה מקצה מלאי באותה טרנזקציה.
 *
 * אישור בלי הקצאה מבטיח פעמיים את אותו פריט, והלקוח השני מגלה את זה
 * רק כשהמשאית לא מגיעה.
 */
export async function approveOrder(tx: Tx, orderId: string): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update orders set status = 'approved', approved_by = current_user_id(), approved_at = now(), hold_reason = null
      where id = $1 and status = 'pending'`,
    [orderId],
  );
  if ((rowCount ?? 0) === 0) return false;

  await tx.query(
    `update inventory_levels i
        set allocated = i.allocated + l.quantity
       from order_lines l
      where l.order_id = $1 and l.product_id = i.product_id and i.location = 'ראשי'`,
    [orderId],
  );
  return true;
}

export async function rejectOrder(tx: Tx, orderId: string, reason: string): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update orders set status = 'rejected', hold_reason = $2 where id = $1 and status in ('pending', 'approved')`,
    [orderId, reason],
  );
  return (rowCount ?? 0) > 0;
}
