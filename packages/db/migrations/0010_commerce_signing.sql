-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 · קטלוג, מלאי, הזמנות והחתמה
--
-- שלוש הכרעות:
--
--   · **מחיר פר-לקוח הוא רשומה, לא הנחה באחוזים.** "כמה זה עולה ליוסי"
--     חייבת להיות שאלה עם תשובה אחת, שאפשר לראות מי שינה ומתי — ולא
--     תוצאה של שרשרת אחוזים שאף אחד לא זוכר.
--
--   · **`available_to_promise` נגזר: `on_hand - allocated`.** מה שנמצא
--     במחסן אינו מה שאפשר להבטיח. הזמנה שאושרה כבר לקחה סחורה.
--
--   · **שורת הזמנה מקפיאה מחיר ושם.** מוצר שמתייקר מחר לא משנה הזמנה
--     של אתמול, ומוצר שנמחק לא הופך הזמנה ישנה לריקה.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── קטלוג ────────────────────────────────────────────────────────────────

create table products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  sku           text not null,
  name          text not null,
  description   text,
  category      text,
  unit          text not null default 'יח׳',
  list_price    numeric(14, 2) not null,
  cost_price    numeric(14, 2),
  vat_rate      numeric(4, 3) not null default 0.18,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),

  constraint products_status_known check (status in ('active', 'discontinued', 'draft')),
  constraint products_price_positive check (list_price >= 0),
  constraint products_sku_uq unique (tenant_id, sku),
  constraint products_tenant_id_uq unique (tenant_id, id)
);
create index products_category_idx on products (tenant_id, category);

create table customer_prices (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid not null,
  product_id    uuid not null,
  price         numeric(14, 2) not null,
  min_quantity  integer not null default 1,
  valid_until   date,
  set_by        uuid,
  created_at    timestamptz not null default now(),

  constraint customer_prices_uq unique (tenant_id, customer_id, product_id, min_quantity),
  constraint customer_prices_tenant_id_uq unique (tenant_id, id),
  constraint customer_prices_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint customer_prices_product_fk
    foreign key (tenant_id, product_id) references products (tenant_id, id) on delete cascade,
  constraint customer_prices_set_by_fk
    foreign key (tenant_id, set_by) references users (tenant_id, id) on delete set null (set_by)
);

-- ── מלאי ─────────────────────────────────────────────────────────────────

create table inventory_levels (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  product_id    uuid not null,
  location      text not null default 'ראשי',
  on_hand       numeric(12, 2) not null default 0,
  allocated     numeric(12, 2) not null default 0,
  reorder_point numeric(12, 2) not null default 0,
  lead_days     integer not null default 7,
  synced_at     timestamptz,

  constraint inventory_non_negative check (on_hand >= 0 and allocated >= 0),
  constraint inventory_uq unique (tenant_id, product_id, location),
  constraint inventory_tenant_id_uq unique (tenant_id, id),
  constraint inventory_product_fk
    foreign key (tenant_id, product_id) references products (tenant_id, id) on delete cascade
);

-- ── הזמנות ───────────────────────────────────────────────────────────────

create table orders (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid not null,
  number         text not null,
  placed_at      timestamptz not null default now(),
  placed_by      text,
  channel        text not null default 'portal',
  status         text not null default 'pending',
  needed_by      date,
  notes          text,
  hold_reason    text,
  approved_by    uuid,
  approved_at    timestamptz,
  invoice_id     uuid,

  constraint orders_status_known
    check (status in ('draft', 'pending', 'approved', 'shipped', 'rejected', 'cancelled')),
  constraint orders_channel_known check (channel in ('portal', 'phone', 'email', 'whatsapp', 'rep')),
  constraint orders_number_uq unique (tenant_id, number),
  constraint orders_tenant_id_uq unique (tenant_id, id),
  constraint orders_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete restrict,
  constraint orders_approved_by_fk
    foreign key (tenant_id, approved_by) references users (tenant_id, id) on delete set null (approved_by),
  constraint orders_invoice_fk
    foreign key (tenant_id, invoice_id) references invoices (tenant_id, id) on delete set null (invoice_id)
);
create index orders_pending_idx on orders (tenant_id, placed_at desc) where status = 'pending';
create index orders_customer_idx on orders (tenant_id, customer_id, placed_at desc);

create table order_lines (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  order_id      uuid not null,
  product_id    uuid,
  -- מוקפא בזמן ההזמנה. מוצר שהתייקר או נמחק לא משנה הזמנה קיימת.
  sku           text not null,
  name          text not null,
  quantity      numeric(12, 2) not null,
  unit_price    numeric(14, 2) not null,
  line_total    numeric(14, 2) not null,
  fulfilled     numeric(12, 2) not null default 0,

  constraint order_lines_quantity_positive check (quantity > 0),
  constraint order_lines_tenant_id_uq unique (tenant_id, id),
  constraint order_lines_order_fk
    foreign key (tenant_id, order_id) references orders (tenant_id, id) on delete cascade,
  constraint order_lines_product_fk
    foreign key (tenant_id, product_id) references products (tenant_id, id) on delete set null (product_id)
);
create index order_lines_order_idx on order_lines (tenant_id, order_id);

-- ── החתמה ────────────────────────────────────────────────────────────────
--
-- החותם אינו משתמש מערכת ואינו משתמש פורטל: הוא אדם חיצוני שמחזיק
-- קישור חד-פעמי. הטוקן נשמר כ-hash — קישור שדלף מהלוגים אינו חתימה.

create table signing_requests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid not null,
  document_id    uuid,
  title          text not null,
  signer_name    text not null,
  signer_email   text,
  signer_phone   text,
  token_hash     text not null,
  status         text not null default 'sent',
  sent_at        timestamptz not null default now(),
  expires_at     timestamptz not null,
  viewed_at      timestamptz,
  signed_at      timestamptz,
  declined_at    timestamptz,
  decline_reason text,
  reminded_at    timestamptz,
  reminder_count integer not null default 0,
  signed_ip      text,
  signed_key     text,

  constraint signing_status_known
    check (status in ('sent', 'viewed', 'signed', 'declined', 'expired', 'void')),
  constraint signing_token_uq unique (token_hash),
  constraint signing_tenant_id_uq unique (tenant_id, id),
  constraint signing_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint signing_document_fk
    foreign key (tenant_id, document_id) references documents (tenant_id, id) on delete set null (document_id)
);
create index signing_open_idx on signing_requests (tenant_id, sent_at desc)
  where status in ('sent', 'viewed');

-- נתיב הביקורת. בלי זה חתימה דיגיטלית רגילה אינה שווה דבר בוויכוח.
create table signing_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null,
  kind          text not null,
  occurred_at   timestamptz not null default now(),
  ip            text,
  user_agent    text,
  detail        jsonb not null default '{}',

  constraint signing_events_tenant_id_uq unique (tenant_id, id),
  constraint signing_events_request_fk
    foreign key (tenant_id, request_id) references signing_requests (tenant_id, id) on delete cascade
);
create index signing_events_request_idx on signing_events (tenant_id, request_id, occurred_at);

-- ── בידוד ────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'products', 'customer_prices', 'inventory_levels',
    'orders', 'order_lines', 'signing_requests', 'signing_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end
$$;

-- מחיקת הזמנה או בקשת חתימה מוחקת ראיה. עובד מבטל, לא מוחק.
create policy orders_delete_owner_only on orders
  as restrictive for delete using (current_user_role() = 'owner');
create policy signing_requests_delete_owner_only on signing_requests
  as restrictive for delete using (current_user_role() = 'owner');
-- נתיב הביקורת אינו נמחק בכלל — גם לא על ידי הבעלים.
create policy signing_events_no_delete on signing_events
  as restrictive for delete using (false);
create policy signing_events_no_update on signing_events
  as restrictive for update using (false);

grant select, insert, update, delete on
  products, customer_prices, inventory_levels, orders, order_lines,
  signing_requests, signing_events
  to bossi_app;
