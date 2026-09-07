-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 · כניסת דמו
--
-- דלת אחורית מכוונת, ולכן היא צרה ככל האפשר ומתועדת:
--
--   1. הפונקציה מסרבת לכל דייר ש-`is_demo` שלו אינו true. הסימון הוא
--      במסד, ולכן משתנה סביבה שהוגדר בטעות לא יכול לפתוח דייר אמיתי.
--   2. היא מקבלת slug ולא מזהה — אין דרך לנחש מזהי דיירים דרכה.
--   3. היא בוחרת את בעל העסק של אותו דייר בלבד.
--   4. החיבור פג אחרי 12 שעות ולא 30 יום, כי דמו הוא ישיבה אחת.
--
-- לכיבוי מלא: להסיר את DEMO_TENANT_SLUGS מהסביבה. הפונקציה נשארת,
-- אבל שום נתיב באפליקציה לא קורא לה.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function auth_demo_session(
  p_slug          text,
  p_session_hash  text,
  p_ttl           interval default interval '12 hours'
) returns table (tenant_id uuid, user_id uuid)
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare
  v_tenant_id uuid;
  v_user_id   uuid;
begin
  select t.id into v_tenant_id
    from tenants t
   where t.slug = p_slug and t.is_demo = true;

  if v_tenant_id is null then
    return;                                  -- לא דייר דמו, או לא קיים
  end if;

  select u.id into v_user_id
    from users u
   where u.tenant_id = v_tenant_id and u.role = 'owner' and u.status = 'active'
   order by u.created_at
   limit 1;

  if v_user_id is null then
    return;
  end if;

  insert into sessions (tenant_id, user_id, token_hash, expires_at, user_agent)
  values (v_tenant_id, v_user_id, p_session_hash, now() + p_ttl, 'demo');

  insert into events (tenant_id, type, actor_type, actor_id, payload)
  values (v_tenant_id, 'kernel.demo_session_started', 'system', v_user_id, '{}'::jsonb);

  return query select v_tenant_id, v_user_id;
end
$$;

revoke all on function auth_demo_session(text, text, interval) from public;
