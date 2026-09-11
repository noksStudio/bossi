-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 · לידים
--
-- ליד הוא לא "לקוח עם סטטוס prospect": יש לו שלבי pipeline אמיתיים
-- (חדש → יצרנו קשר → מוכשר → הצעה → נסגר/נפל), מקור, ואולי לקוח קיים
-- שהפנה אותו — ורק בהמרה מפורשת הוא הופך לרשומת `customers` אמיתית.
-- FK מורכב אל customers (tenant_id, id) בשני הכיוונים (מי הפנה, ולאיזה
-- לקוח הפך) — CLAUDE.md כלל 1א.
--
-- כיתוב על ליד (הערות, מעקב) לא מקבל טבלה חדשה: `notes` (0007) כבר
-- פולימורפית ב-subject_type/subject_id בדיוק בשביל זה — "מודול חדש
-- יוכל להיתלות עליהן בלי מיגרציה", בדיוק כמו שכתוב שם.
-- ═══════════════════════════════════════════════════════════════════════════

create table leads (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  display_name             text not null,
  stage                    text not null default 'new',
  source                   text,
  referred_by_customer_id  uuid,
  contact_name             text,
  contact_email            text,
  contact_phone            text,
  next_follow_up_on        date,
  converted_customer_id    uuid,
  lost_reason              text,
  created_at               timestamptz not null default now(),

  constraint leads_stage_known
    check (stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  -- מקור פתוח בכוונה (בניגוד ל-stage): ערוצי שיווק חדשים לא צריכים
  -- מיגרציה, רק תווית חדשה בקוד (LEAD_SOURCES).
  constraint leads_referred_by_fk
    foreign key (tenant_id, referred_by_customer_id) references customers (tenant_id, id) on delete set null,
  constraint leads_converted_customer_fk
    foreign key (tenant_id, converted_customer_id) references customers (tenant_id, id) on delete set null
);

create index leads_tenant_stage_idx on leads (tenant_id, stage);
-- מעקב: לידים חיים (לא סגורים/נפלו) שהגיע זמנם, למסך "היום".
create index leads_follow_up_idx on leads (tenant_id, next_follow_up_on)
  where stage not in ('won', 'lost');

alter table leads enable row level security;
alter table leads force row level security;

create policy tenant_isolation on leads
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

grant select, insert, update, delete on leads to bossi_app;
