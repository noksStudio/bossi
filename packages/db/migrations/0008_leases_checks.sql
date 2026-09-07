-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 · נכסים, חוזי שכירות וצ'קים דחויים
--
-- שתי הישויות שמנהלות עסק השכרה: חוזה שיש לו תאריך תפוגה, וכסף שמגיע
-- בצ'קים דחויים שצריך לוודא שנפרעו.
--
-- שתי החלטות שכדאי לשים לב אליהן:
--
--   · `notice_deadline` נגזר ולא נשמר. ההתראה רצה על **מועד ההודעה
--     המוקדמת** ולא על תאריך הסיום — חוזה שנגמר ב-31.12 עם 90 יום
--     הודעה כבר "בוער" ב-2.10. התראה על תאריך הסיום מגיעה מאוחר מדי.
--
--   · לצ'ק יש `amount` (מה שרשום עליו) ו-`cleared_amount` (מה שנכנס
--     בפועל). "הועבר 2000 במקום 2200" הוא פירעון חלקי עם יתרה פתוחה,
--     לא הערה חופשית שתיעלם בעוד שנה.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── נכסים ────────────────────────────────────────────────────────────────
-- דירות בודדות, בלי היררכיית בניין/יחידה. אם יתווספו בנייני מגורים,
-- `parent_id` יאפשר את זה בלי לשבור את הקיים.

create table properties (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  parent_id     uuid,
  name          text not null,
  address       text,
  city          text,
  rooms         numeric(3, 1),
  size_sqm      integer,
  status        text not null default 'available',
  notes         text,
  created_at    timestamptz not null default now(),
  constraint properties_status_known check (status in ('available', 'rented', 'maintenance', 'inactive')),
  constraint properties_tenant_id_uq unique (tenant_id, id),
  constraint properties_parent_fk
    foreign key (tenant_id, parent_id) references properties (tenant_id, id) on delete set null (parent_id)
);
create index properties_status_idx on properties (tenant_id, status);

-- ── חוזי שכירות ──────────────────────────────────────────────────────────

create table leases (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  property_id     uuid not null,
  customer_id     uuid not null,
  starts_on       date not null,
  ends_on         date not null,
  notice_days     integer not null default 90,
  monthly_rent    numeric(14, 2) not null,
  currency        text not null default 'ILS',
  deposit_amount  numeric(14, 2),
  indexation      text,
  option_months   integer,
  status          text not null default 'active',
  signed_on       date,
  notes           text,
  created_at      timestamptz not null default now(),

  constraint leases_status_known
    check (status in ('draft', 'active', 'ending', 'ended', 'renewed', 'cancelled')),
  constraint leases_dates_sane check (ends_on > starts_on),
  constraint leases_notice_sane check (notice_days between 0 and 365),
  constraint leases_tenant_id_uq unique (tenant_id, id),
  constraint leases_property_fk
    foreign key (tenant_id, property_id) references properties (tenant_id, id) on delete restrict,
  constraint leases_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete restrict
);
create index leases_customer_idx on leases (tenant_id, customer_id);
create index leases_ends_idx on leases (tenant_id, ends_on) where status = 'active';

/** מועד ההודעה המוקדמת — התאריך שממנו החוזה "בוער". */
create or replace function lease_notice_deadline(p_ends_on date, p_notice_days integer)
  returns date language sql immutable
as $$ select p_ends_on - p_notice_days; $$;

-- ── צ'קים דחויים ─────────────────────────────────────────────────────────
--
-- הם מגיעים כחבילה בחתימת החוזה — 12 צ'קים בבת אחת — ולכן החבילה
-- היא ישות ולא רק שדה. היא גם מה שנותן תשובה ל"איפה הצ'קים פיזית".

create table check_batches (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid not null,
  lease_id      uuid,
  received_on   date not null default current_date,
  location      text,
  notes         text,
  created_at    timestamptz not null default now(),
  constraint check_batches_tenant_id_uq unique (tenant_id, id),
  constraint check_batches_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint check_batches_lease_fk
    foreign key (tenant_id, lease_id) references leases (tenant_id, id) on delete set null (lease_id)
);

create table checks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  customer_id     uuid not null,
  lease_id        uuid,
  batch_id        uuid,

  check_number    text,
  bank_name       text,
  bank_code       text,
  branch_code     text,
  account_number  text,

  amount          numeric(14, 2) not null,
  currency        text not null default 'ILS',
  due_on          date not null,

  status          text not null default 'pending',
  cleared_on      date,
  cleared_amount  numeric(14, 2),
  cleared_by      uuid,
  cleared_at      timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),

  constraint checks_status_known
    check (status in ('pending', 'cleared', 'partial', 'bounced', 'void')),
  constraint checks_amount_positive check (amount > 0),
  -- פירעון חלקי חייב סכום בפועל; פירעון מלא לא סותר את עצמו.
  constraint checks_partial_has_amount
    check (status <> 'partial' or (cleared_amount is not null and cleared_amount < amount)),
  constraint checks_tenant_id_uq unique (tenant_id, id),
  constraint checks_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint checks_lease_fk
    foreign key (tenant_id, lease_id) references leases (tenant_id, id) on delete set null (lease_id),
  constraint checks_batch_fk
    foreign key (tenant_id, batch_id) references check_batches (tenant_id, id) on delete set null (batch_id),
  constraint checks_cleared_by_fk
    foreign key (tenant_id, cleared_by) references users (tenant_id, id) on delete set null (cleared_by)
);

-- השאילתה המרכזית: "מה אמור להיפרע החודש".
create index checks_due_idx on checks (tenant_id, due_on);
-- ומיד אחריה: "מה עבר את התאריך ועדיין לא סומן".
create index checks_open_idx on checks (tenant_id, due_on) where status = 'pending';
create index checks_customer_idx on checks (tenant_id, customer_id, due_on desc);

do $$
declare t text;
begin
  foreach t in array array['properties', 'leases', 'check_batches', 'checks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end
$$;

-- מחיקת צ'ק או חוזה היא פעולה הרסנית על רשומה כספית — רק הבעלים.
-- עובד יכול לסמן, לתקן ולהוסיף, לא למחוק.
create policy checks_delete_owner_only on checks
  as restrictive for delete using (current_user_role() = 'owner');
create policy leases_delete_owner_only on leases
  as restrictive for delete using (current_user_role() = 'owner');

grant select, insert, update, delete on properties, leases, check_batches, checks to bossi_app;
