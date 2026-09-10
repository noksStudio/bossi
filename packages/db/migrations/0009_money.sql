-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 · חשבוניות, תקבולים, ריטיינרים וגבייה
--
-- שלוש שכבות שנראות כמו אחת ואינן:
--
--   · **חשבונית** היא דרישה. **תקבול** הוא כסף שנכנס. **הקצאה** היא
--     ההחלטה איזה כסף סוגר איזו דרישה. תשלום אחד יכול לסגור שלוש
--     חשבוניות, וחשבונית אחת יכולה להיסגר בשלושה תשלומים — ולכן
--     `payment_allocations` היא טבלה ולא שדה.
--
--   · **יתרת החשבונית נגזרת ולא נשמרת.** `amount - sum(allocations)`.
--     סכום ששמור בשני מקומות מתפצל, ואז אף אחד לא יודע איזה נכון.
--
--   · **ריטיינר הוא הסכם; תקופה היא החודש.** הצריכה נרשמת לתקופה,
--     והחריגה מחושבת מול המכסה של אותה תקופה בלבד. חודש שנסגר
--     קפוא — לא משנים אותו כי מישהו רשם שעה באיחור.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── חשבוניות ─────────────────────────────────────────────────────────────

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid not null,
  number         text not null,
  issued_on      date not null default current_date,
  due_on         date not null,
  amount         numeric(14, 2) not null,
  vat_amount     numeric(14, 2) not null default 0,
  currency       text not null default 'ILS',
  status         text not null default 'open',
  subject        text,
  source         text,
  external_id    text,
  notes          text,
  created_at     timestamptz not null default now(),

  constraint invoices_status_known
    check (status in ('draft', 'open', 'paid', 'void', 'written_off')),
  constraint invoices_amount_positive check (amount > 0),
  constraint invoices_dates_sane check (due_on >= issued_on),
  constraint invoices_number_uq unique (tenant_id, number),
  constraint invoices_tenant_id_uq unique (tenant_id, id),
  constraint invoices_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete restrict
);
-- שאילתת האייג'ינג: מה פתוח, מסודר לפי כמה זמן הוא פתוח.
create index invoices_open_idx on invoices (tenant_id, due_on) where status = 'open';
create index invoices_customer_idx on invoices (tenant_id, customer_id, issued_on desc);

-- ── תקבולים ──────────────────────────────────────────────────────────────

create table payments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid not null,
  received_on    date not null default current_date,
  amount         numeric(14, 2) not null,
  currency       text not null default 'ILS',
  method         text not null default 'transfer',
  reference      text,
  check_id       uuid,
  notes          text,
  created_at     timestamptz not null default now(),

  constraint payments_method_known
    check (method in ('transfer', 'check', 'card', 'cash', 'standing_order', 'other')),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_tenant_id_uq unique (tenant_id, id),
  constraint payments_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete restrict,
  -- תקבול שמקורו בצ'ק דחוי מצביע חזרה על הצ'ק. כך "הכסף נכנס" ו"הצ'ק
  -- נפרע" הם אותה עובדה ולא שתי רשומות שסותרות זו את זו.
  constraint payments_check_fk
    foreign key (tenant_id, check_id) references checks (tenant_id, id) on delete set null (check_id)
);
create index payments_customer_idx on payments (tenant_id, customer_id, received_on desc);

create table payment_allocations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  payment_id     uuid not null,
  invoice_id     uuid not null,
  amount         numeric(14, 2) not null,
  created_at     timestamptz not null default now(),

  constraint payment_allocations_amount_positive check (amount > 0),
  constraint payment_allocations_uq unique (tenant_id, payment_id, invoice_id),
  constraint payment_allocations_tenant_id_uq unique (tenant_id, id),
  constraint payment_allocations_payment_fk
    foreign key (tenant_id, payment_id) references payments (tenant_id, id) on delete cascade,
  constraint payment_allocations_invoice_fk
    foreign key (tenant_id, invoice_id) references invoices (tenant_id, id) on delete cascade
);
create index payment_allocations_invoice_idx on payment_allocations (tenant_id, invoice_id);

-- ── גבייה: הבטחות תשלום ─────────────────────────────────────────────────
--
-- "אשלם ביום ראשון" הוא נתון, לא זיכרון. הבטחה שהופרה היא האות הכי
-- חזק לתעדוף — חזק יותר מגובה החוב.

create table promises_to_pay (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid not null,
  invoice_id     uuid,
  promised_on    date not null default current_date,
  promised_for   date not null,
  amount         numeric(14, 2),
  channel        text,
  status         text not null default 'open',
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),

  constraint promises_status_known check (status in ('open', 'kept', 'broken', 'cancelled')),
  constraint promises_tenant_id_uq unique (tenant_id, id),
  constraint promises_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint promises_invoice_fk
    foreign key (tenant_id, invoice_id) references invoices (tenant_id, id) on delete set null (invoice_id),
  constraint promises_created_by_fk
    foreign key (tenant_id, created_by) references users (tenant_id, id) on delete set null (created_by)
);
create index promises_open_idx on promises_to_pay (tenant_id, promised_for) where status = 'open';

-- ── תזכורות שנשלחו ───────────────────────────────────────────────────────
-- מה נשלח, מתי, באיזה טון. בלי זה אי אפשר לדעת אם מותר לשלוח שוב.

create table dunning_runs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid not null,
  invoice_id     uuid,
  sent_at        timestamptz not null default now(),
  channel        text not null default 'email',
  tone           text not null default 'soft',
  step           integer not null default 1,
  outcome        text,

  constraint dunning_channel_known check (channel in ('email', 'whatsapp', 'sms', 'phone')),
  constraint dunning_tone_known check (tone in ('soft', 'neutral', 'firm')),
  constraint dunning_tenant_id_uq unique (tenant_id, id),
  constraint dunning_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint dunning_invoice_fk
    foreign key (tenant_id, invoice_id) references invoices (tenant_id, id) on delete set null (invoice_id)
);
create index dunning_customer_idx on dunning_runs (tenant_id, customer_id, sent_at desc);

-- ── ריטיינרים ────────────────────────────────────────────────────────────

create table retainers (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  customer_id      uuid not null,
  name             text not null,
  monthly_fee      numeric(14, 2) not null,
  quota_amount     numeric(10, 2) not null,
  quota_unit       text not null default 'hours',
  rollover         boolean not null default false,
  starts_on        date not null,
  ends_on          date,
  notice_days      integer not null default 30,
  price_updated_on date,
  status           text not null default 'active',
  notes            text,
  created_at       timestamptz not null default now(),

  constraint retainers_status_known check (status in ('active', 'paused', 'ended')),
  constraint retainers_unit_known check (quota_unit in ('hours', 'items', 'scope')),
  constraint retainers_fee_positive check (monthly_fee > 0),
  constraint retainers_tenant_id_uq unique (tenant_id, id),
  constraint retainers_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade
);
create index retainers_customer_idx on retainers (tenant_id, customer_id);

create table retainer_periods (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  retainer_id    uuid not null,
  starts_on      date not null,
  ends_on        date not null,
  quota_amount   numeric(10, 2) not null,
  status         text not null default 'open',
  invoice_id     uuid,
  closed_at      timestamptz,

  constraint retainer_periods_status_known check (status in ('open', 'closed', 'billed')),
  constraint retainer_periods_uq unique (tenant_id, retainer_id, starts_on),
  constraint retainer_periods_tenant_id_uq unique (tenant_id, id),
  constraint retainer_periods_retainer_fk
    foreign key (tenant_id, retainer_id) references retainers (tenant_id, id) on delete cascade,
  constraint retainer_periods_invoice_fk
    foreign key (tenant_id, invoice_id) references invoices (tenant_id, id) on delete set null (invoice_id)
);
create index retainer_periods_open_idx on retainer_periods (tenant_id, starts_on desc);

create table consumption_entries (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  period_id      uuid not null,
  occurred_on    date not null default current_date,
  quantity       numeric(10, 2) not null,
  description    text not null,
  user_id        uuid,
  billable       boolean not null default true,
  created_at     timestamptz not null default now(),

  constraint consumption_quantity_positive check (quantity > 0),
  constraint consumption_tenant_id_uq unique (tenant_id, id),
  constraint consumption_period_fk
    foreign key (tenant_id, period_id) references retainer_periods (tenant_id, id) on delete cascade,
  constraint consumption_user_fk
    foreign key (tenant_id, user_id) references users (tenant_id, id) on delete set null (user_id)
);
create index consumption_period_idx on consumption_entries (tenant_id, period_id, occurred_on);

-- ── בידוד ────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'invoices', 'payments', 'payment_allocations', 'promises_to_pay',
    'dunning_runs', 'retainers', 'retainer_periods', 'consumption_entries'
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

-- מחיקת רשומה כספית היא פעולה הרסנית — רק הבעלים. עובד מבטל חשבונית
-- (`status = 'void'`), ומשאיר עקבות.
create policy invoices_delete_owner_only on invoices
  as restrictive for delete using (current_user_role() = 'owner');
create policy payments_delete_owner_only on payments
  as restrictive for delete using (current_user_role() = 'owner');
create policy retainers_delete_owner_only on retainers
  as restrictive for delete using (current_user_role() = 'owner');

grant select, insert, update, delete on
  invoices, payments, payment_allocations, promises_to_pay,
  dunning_runs, retainers, retainer_periods, consumption_entries
  to bossi_app;
