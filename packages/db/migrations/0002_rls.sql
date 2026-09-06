-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 · בידוד דיירים
--
-- זו המיגרציה החשובה ביותר במערכת. Bossi מחזיקה חוזים וכסף של עסקים אחרים,
-- ודליפה אחת בין דיירים סוגרת את החברה.
--
-- הבידוד לא נשען על "לא נשכח להוסיף WHERE tenant_id". הוא נאכף במסד:
--
--   1. `bossi_app` — התפקיד שהאפליקציה רצה תחתיו. אין לו BYPASSRLS.
--   2. `current_tenant()` — קורא GUC מקומי לטרנזקציה. לא מוגדר → NULL → אפס שורות.
--      כשל סגור, לא כשל פתוח.
--   3. FORCE ROW LEVEL SECURITY — בלי זה בעל הטבלה עוקף את המדיניות,
--      וב-Neon בעל הטבלה הוא בדיוק מי שהאפליקציה מתחברת בתור. השורה הזו
--      היא ההבדל בין בידוד אמיתי לבין בידוד לכאורה.
--   4. `events` מקבל SELECT ו-INSERT בלבד — append-only נאכף ברמת ההרשאה,
--      לא ברמת המשמעת.
--
-- טבלת `tenants` היא היחידה שאינה FORCE: היא צריכה נתיב יצירה. במקום זה
-- ל-bossi_app אין בה הרשאת כתיבה כלל, אז הוא לא יכול ליצור או לשנות דיירים.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function current_tenant() returns uuid
  language sql stable
  set search_path = pg_catalog, public
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid;
$$;

comment on function current_tenant() is
  'הדייר של הטרנזקציה הנוכחית. NULL כשלא הוגדר — ואז שום מדיניות לא מתקיימת.';

-- ── התפקיד שהאפליקציה רצה תחתיו ───────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bossi_app') then
    create role bossi_app nologin;
  end if;
end
$$;

-- כדי שהחיבור יוכל לעשות SET LOCAL ROLE bossi_app
do $$
begin
  execute format('grant bossi_app to %I', current_user);
exception when duplicate_object or invalid_grant_operation then null;
end
$$;

grant usage on schema public to bossi_app;
grant execute on function current_tenant() to bossi_app;

-- ── מדיניות ───────────────────────────────────────────────────────────────

-- דיירים: קריאה בלבד, ורק את עצמך.
alter table tenants enable row level security;
create policy tenant_self on tenants
  using (id = current_tenant());
grant select on tenants to bossi_app;

-- כל השאר: בידוד מלא, כולל מול בעל הטבלה.
do $$
declare
  t text;
begin
  foreach t in array array[
    'tenant_modules', 'subscriptions', 'users', 'portal_users', 'customers', 'contacts', 'events'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end
$$;

grant select, insert, update, delete on
  tenant_modules, subscriptions, users, portal_users, customers, contacts
  to bossi_app;

-- append-only: אין UPDATE ואין DELETE. לא כמוסכמה — כהרשאה.
grant select, insert on events to bossi_app;
grant usage, select on all sequences in schema public to bossi_app;
