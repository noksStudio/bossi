-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 · אימות צוות (magic link)
--
-- בלי סיסמאות: אין מה לגנוב, אין מה למחזר, ואין מסך "שכחתי סיסמה".
--
-- הקושי האמיתי כאן הוא סדר הפעולות: כשמגיעה בקשה עם עוגייה, עוד לא ידוע
-- מיהו הדייר — ולכן אי אפשר להיכנס דרך withTenant(). ומכיוון שכל הטבלאות
-- הן FORCE RLS, גם withPlatform() לא רואה כלום.
--
-- הפתרון הוא לא לוותר על הבידוד אלא לצמצם את החציה לפונקציות SECURITY
-- DEFINER צרות, שכל אחת מהן עושה דבר אחד ומחזירה בדיוק את מה שנחוץ.
-- זה כל משטח החציה במערכת, והוא כתוב כאן במלואו.
--
-- אסימונים נשמרים כ-SHA-256 בלבד. דליפה של המסד לא מאפשרת התחברות.
-- ═══════════════════════════════════════════════════════════════════════════

-- נדרש למפתחות זרים מודעי-דייר (ADR-005)
alter table users add constraint users_tenant_id_uq unique (tenant_id, id);

create table login_tokens (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid not null,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint login_tokens_user_fk
    foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);
create index login_tokens_expiry_idx on login_tokens (expires_at) where consumed_at is null;

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid not null,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  user_agent    text,
  constraint sessions_user_fk
    foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);
create index sessions_user_idx on sessions (tenant_id, user_id);

do $$
declare t text;
begin
  foreach t in array array['login_tokens', 'sessions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end
$$;

-- הצוות רשאי לראות ולנתק את החיבורים של הדייר שלו, לא ליצור אותם.
grant select, delete on sessions to bossi_app;
grant select on login_tokens to bossi_app;

-- ───────────────────────────────────────────────────────── בקשת התחברות

/**
 * מנפיק אסימון התחברות למשתמש פעיל.
 *
 * מחזיר NULL כשאין התאמה — וגם כשיש יותר מאחת. אותה כתובת בשני דיירים
 * היא מצב לא פתיר בלי לשאול את המשתמש לאיזה עסק הוא מתכוון, ולכן עדיף
 * להיכשל מאשר לנחש ולהכניס אותו לעסק הלא נכון.
 *
 * הקורא מקבל אותה תשובה גם כשהכתובת לא קיימת — כדי לא להסגיר מי רשום.
 */
create or replace function auth_issue_login_token(
  p_email       text,
  p_token_hash  text,
  p_ttl         interval default interval '20 minutes'
) returns uuid
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare
  v_tenant_id uuid;
  v_user_id   uuid;
  v_matches   integer;
begin
  select count(*) into v_matches
    from users
   where lower(email) = lower(p_email) and status = 'active';

  if v_matches <> 1 then
    return null;
  end if;

  select tenant_id, id into v_tenant_id, v_user_id
    from users
   where lower(email) = lower(p_email) and status = 'active';

  -- אסימון פתוח קודם מתבטל: בקשה חדשה מבטלת את הקישור הישן.
  update login_tokens
     set consumed_at = now()
   where user_id = v_user_id and consumed_at is null;

  insert into login_tokens (tenant_id, user_id, token_hash, expires_at)
  values (v_tenant_id, v_user_id, p_token_hash, now() + p_ttl);

  return v_tenant_id;
end
$$;

-- ───────────────────────────────────────────────── מימוש אסימון ליצירת חיבור

/**
 * ממיר אסימון התחברות לחיבור. חד-פעמי: השורה מסומנת כמנוצלת באותה
 * טרנזקציה שבה נוצר החיבור, ולכן לחיצה חוזרת על אותו קישור לא תעבוד.
 */
create or replace function auth_consume_login_token(
  p_token_hash    text,
  p_session_hash  text,
  p_ttl           interval default interval '30 days',
  p_user_agent    text default null
) returns table (tenant_id uuid, user_id uuid)
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare
  v_tenant_id uuid;
  v_user_id   uuid;
begin
  update login_tokens
     set consumed_at = now()
   where token_hash = p_token_hash
     and consumed_at is null
     and expires_at > now()
  returning login_tokens.tenant_id, login_tokens.user_id
       into v_tenant_id, v_user_id;

  if v_tenant_id is null then
    return;
  end if;

  insert into sessions (tenant_id, user_id, token_hash, expires_at, user_agent)
  values (v_tenant_id, v_user_id, p_session_hash, now() + p_ttl, p_user_agent);

  insert into events (tenant_id, type, actor_type, actor_id, payload)
  values (v_tenant_id, 'kernel.user_signed_in', 'user', v_user_id, '{}'::jsonb);

  return query select v_tenant_id, v_user_id;
end
$$;

-- ───────────────────────────────────────────────────────── פענוח חיבור

/**
 * מזהה את בעל החיבור. הפונקציה היחידה שרצה בכל בקשה, ולכן היא מחזירה
 * את המינימום ההכרחי כדי לפתוח הקשר של דייר.
 *
 * last_seen_at מתעדכן לכל היותר פעם בחמש דקות — אחרת כל טעינת עמוד
 * הופכת לכתיבה.
 */
create or replace function auth_resolve_session(p_token_hash text)
  returns table (
    tenant_id     uuid,
    tenant_slug   text,
    tenant_name   text,
    user_id       uuid,
    user_email    text,
    user_name     text,
    user_role     text
  )
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
begin
  update sessions
     set last_seen_at = now()
   where token_hash = p_token_hash
     and expires_at > now()
     and last_seen_at < now() - interval '5 minutes';

  return query
    select t.id, t.slug, t.name, u.id, u.email, u.name, u.role
      from sessions s
      join users u on u.id = s.user_id and u.tenant_id = s.tenant_id
      join tenants t on t.id = s.tenant_id
     where s.token_hash = p_token_hash
       and s.expires_at > now()
       and u.status = 'active';
end
$$;

create or replace function auth_revoke_session(p_token_hash text) returns void
  language sql
  security definer
  set search_path = pg_catalog, public
as $$
  delete from sessions where token_hash = p_token_hash;
$$;

/** ניקוי תקופתי. אסימונים שפגו ואינם מנוצלים אינם משמשים לכלום. */
create or replace function auth_purge_expired() returns integer
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  delete from login_tokens where expires_at < now() - interval '1 day';
  get diagnostics v_count = row_count;
  delete from sessions where expires_at < now();
  return v_count;
end
$$;

revoke all on function auth_issue_login_token(text, text, interval) from public;
revoke all on function auth_consume_login_token(text, text, interval, text) from public;
revoke all on function auth_resolve_session(text) from public;
revoke all on function auth_revoke_session(text) from public;
revoke all on function auth_purge_expired() from public;
