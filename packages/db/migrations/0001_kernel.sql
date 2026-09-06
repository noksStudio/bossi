-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 · טבלאות הקרנל
--
-- הקרנל הוא מה שתמיד קיים, בלי קשר לאילו מודולים הדייר הפעיל:
-- דיירים, זהות (שני עולמות נפרדים), לקוחות, ואירועים.
-- כל טבלה נושאת tenant_id. הבידוד עצמו נאכף ב-0002.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

-- ── דיירים ────────────────────────────────────────────────────────────────

create table tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  business_id   text,                                   -- ח"פ / ע"מ
  timezone      text not null default 'Asia/Jerusalem',
  locale        text not null default 'he-IL',
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint tenants_slug_shape check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);

-- אילו מודולים דלוקים אצל הדייר, ומה ההגדרות שלהם.
-- מודול שמכובה לא נמחק — enabled=false בלבד, כדי שהדלקה מחדש תחזיר את ההיסטוריה.
create table tenant_modules (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  module_id     text not null,
  enabled       boolean not null default true,
  settings      jsonb not null default '{}'::jsonb,
  enabled_at    timestamptz not null default now(),
  disabled_at   timestamptz,
  primary key (tenant_id, module_id)
);

-- המנוי של הדייר מול Bossi. נפרד לגמרי מהחיוב של הדייר את הלקוחות שלו.
create table subscriptions (
  tenant_id             uuid primary key references tenants(id) on delete cascade,
  plan                  text not null default 'starter',
  status                text not null default 'trialing',
  cycle_start_day       smallint not null default 1,
  current_period_start  date not null default current_date,
  current_period_end    date not null default (current_date + interval '1 month')::date,
  trial_ends_on         date,
  created_at            timestamptz not null default now(),
  constraint subscriptions_plan_known check (plan in ('starter', 'pro', 'mega')),
  constraint subscriptions_status_known check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  constraint subscriptions_cycle_day check (cycle_start_day between 1 and 28)
);

-- ── זהות · עולם הצוות ─────────────────────────────────────────────────────

create table users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  email         text not null,
  name          text not null,
  role          text not null default 'staff',
  status        text not null default 'active',
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint users_role_known check (role in ('owner', 'manager', 'staff', 'bookkeeper')),
  constraint users_status_known check (status in ('active', 'invited', 'suspended'))
);
create unique index users_tenant_email_uq on users (tenant_id, lower(email));

-- ── זהות · עולם הלקוחות ───────────────────────────────────────────────────
--
-- טבלה נפרדת בכוונה, לא תפקיד על `users`. הרשאה שדולפת בין שני העולמות
-- היא הבאג הכי מסוכן במערכת מהסוג הזה (CLAUDE.md כלל 2).
-- נוצרת כבר עכשיו למרות שהפורטל נבנה בספרינט 13 — הוספת עולם זהות
-- שני בדיעבד היא שכתוב, לא תוספת.

create table portal_users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid not null,
  email         text not null,
  name          text not null,
  status        text not null default 'invited',
  permissions   text[] not null default '{}',
  invited_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  constraint portal_users_status_known check (status in ('active', 'invited', 'revoked'))
);
create unique index portal_users_tenant_email_uq on portal_users (tenant_id, lower(email));

-- ── לקוחות ────────────────────────────────────────────────────────────────

create table customers (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  display_name        text not null,
  legal_name          text,
  business_id         text,
  status              text not null default 'active',
  payment_terms_days  integer not null default 30,
  credit_limit        numeric(14, 2),
  tags                text[] not null default '{}',
  notes               text,
  created_at          timestamptz not null default now(),
  constraint customers_status_known check (status in ('active', 'prospect', 'dormant', 'archived')),
  constraint customers_terms_sane check (payment_terms_days between 0 and 365),
  -- מאפשר מפתחות זרים מורכבים שכוללים את הדייר. ראה ההערה מתחת.
  constraint customers_tenant_id_uq unique (tenant_id, id)
);

-- ── מפתחות זרים מודעי־דייר ────────────────────────────────────────────────
--
-- בדיקת מפתח זר ב-Postgres רצה בנתיב מיוחס ומתעלמת מ-RLS. לכן FK רגיל
-- `customer_id → customers(id)` יאפשר לדייר א ליצור איש קשר שמצביע על לקוח
-- של דייר ב: השורה נכתבת עם tenant_id של א (המדיניות מרוצה), אבל ההצבעה
-- חוצה דיירים. התוצאה היא שחיתות רפרנציאלית ודליפה של קיום מזהים.
--
-- הפתרון: כל FK אל ישות של דייר כולל את tenant_id. אז ההצבעה יכולה
-- להתקיים רק בתוך אותו דייר, והאכיפה היא של המסד ולא של המדיניות.
-- זו הסיבה ל-`customers_tenant_id_uq` שלמעלה.
create index customers_tenant_status_idx on customers (tenant_id, status);
create index customers_name_trgm_idx on customers using gin (display_name gin_trgm_ops);

alter table portal_users
  add constraint portal_users_customer_fk
  foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade;

-- ב-B2B מי שמזמין, מי שמאשר ומי שמשלם הם לרוב שלושה אנשים שונים.
create table contacts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid not null,
  name          text not null,
  email         text,
  phone         text,
  roles         text[] not null default '{}',           -- orders | approves | pays | legal
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint contacts_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade
);
create index contacts_customer_idx on contacts (tenant_id, customer_id);

-- ── אירועים · עמוד השדרה ──────────────────────────────────────────────────
--
-- append-only. ציר הזמן, ההתראות והאודיט כולם צרכנים של הטבלה הזו.
-- אין כאן update ואין delete — 0002 אוכף את זה גם ברמת המדיניות.

create table events (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  occurred_at   timestamptz not null default now(),
  type          text not null,
  actor_type    text,                                   -- user | portal_user | system | integration
  actor_id      uuid,
  customer_id   uuid,
  subject_type  text,
  subject_id    uuid,
  payload       jsonb not null default '{}'::jsonb,
  constraint events_type_shape check (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint events_actor_known check (actor_type is null or actor_type in ('user', 'portal_user', 'system', 'integration')),
  -- מחיקת לקוח לא מוחקת את ההיסטוריה שלו — רק מנתקת אותה.
  -- רשימת העמודות ב-SET NULL היא תחביר של Postgres 15+, ומונעת ניסיון
  -- לאפס גם את tenant_id שהוא NOT NULL.
  constraint events_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id)
    on delete set null (customer_id)
);
create index events_timeline_idx on events (tenant_id, customer_id, occurred_at desc);
create index events_type_idx on events (tenant_id, type, occurred_at desc);
create index events_subject_idx on events (tenant_id, subject_type, subject_id);
