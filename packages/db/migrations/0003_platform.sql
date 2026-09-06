-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 · נתיב הפלטפורמה
--
-- יצירת דייר חדש היא הפעולה היחידה שאינה שייכת לשום דייר, ולכן היא לא יכולה
-- לרוץ תחת bossi_app. היא רצה תחת בעל הסכמה, ורק מ-`withPlatform()`.
-- הפונקציה הזו היא הנתיב היחיד — כך שקל למצוא בקוד מי יוצר דיירים.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function platform_create_tenant(
  p_slug        text,
  p_name        text,
  p_plan        text default 'starter',
  p_modules     text[] default array[]::text[],
  p_business_id text default null
) returns uuid
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare
  v_tenant_id uuid;
  v_module    text;
begin
  insert into tenants (slug, name, business_id)
  values (p_slug, p_name, p_business_id)
  returning id into v_tenant_id;

  insert into subscriptions (tenant_id, plan)
  values (v_tenant_id, p_plan);

  foreach v_module in array p_modules loop
    insert into tenant_modules (tenant_id, module_id)
    values (v_tenant_id, v_module)
    on conflict do nothing;
  end loop;

  insert into events (tenant_id, type, actor_type, payload)
  values (v_tenant_id, 'kernel.tenant_created', 'system',
          jsonb_build_object('plan', p_plan, 'modules', to_jsonb(p_modules)));

  return v_tenant_id;
end
$$;

revoke all on function platform_create_tenant(text, text, text, text[], text) from public;

comment on function platform_create_tenant(text, text, text, text[], text) is
  'הנתיב היחיד ליצירת דייר. security definer כדי לעקוף FORCE RLS על טבלאות הבת.';
