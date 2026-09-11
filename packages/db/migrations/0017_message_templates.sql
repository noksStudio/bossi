-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 · תבניות הודעה
--
-- תבנית שמורה להודעת פנייה — קרה או חמה, וואטסאפ/מייל/לינקדאין/טלפון.
-- לא כלי שליחה: אין כאן שום אינטגרציה עם ערוץ תקשורת, רק טקסט שמור
-- עם placeholders שממלאים כשמעתיקים (ראו packages/db/src/templates.ts).
-- זו בדיוק ההבחנה שנדונה במפורש לפני שהתחיל צינור הלידים: המערכת
-- עוזרת לבנות ולמדוד את הפנייה הידנית, לא מבצעת אותה בעצמה.
-- ═══════════════════════════════════════════════════════════════════════════

create table message_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  channel     text not null default 'whatsapp',
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,

  constraint message_templates_channel_known
    check (channel in ('whatsapp', 'email', 'linkedin', 'phone', 'other')),
  constraint message_templates_name_not_empty check (length(btrim(name)) > 0),
  constraint message_templates_body_not_empty check (length(btrim(body)) > 0)
);
create index message_templates_tenant_idx on message_templates (tenant_id, created_at desc);

alter table message_templates enable row level security;
alter table message_templates force row level security;

create policy tenant_isolation on message_templates
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

grant select, insert, update, delete on message_templates to bossi_app;
