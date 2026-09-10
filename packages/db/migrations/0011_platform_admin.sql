-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 · ריאלם הפלטפורמה
--
-- **ריאלם זהות שלישי.** `users` הוא הצוות של הדייר, `portal_users` הוא
-- הלקוחות שלו, וכאן יושב מי שמפעיל את Bossi עצמה. שלושתם מופרדים
-- בטבלה, בעוגייה וב-middleware (CLAUDE.md כלל 2).
--
-- למה לא תפקיד `superadmin` על `users`: הטבלה הזו מבודדת לפי דייר, ולכן
-- זהות חוצת-דיירים לא יכולה לשבת בה בלי לשבור את הבידוד. וברגע שקיים
-- תפקיד אחד שמדלג על הבידוד, כל באג הרשאות בצד הצוות הופך לדליפה בין
-- לקוחות. הפרדה בטבלה הופכת את זה מ"שאלה של זהירות" ל"בלתי אפשרי".
--
-- **מה שאין כאן במכוון:** אין לאדמין הפלטפורמה שום נתיב לדאטה של דייר.
-- הוא רואה מטא-דאטה — כמה לקוחות, כמה מסמכים, איזו חבילה — ולא תוכן.
-- התחזות ללקוח היא החלטה נפרדת שתדרוש ADR משלה.
--
-- שתי הטבלאות כאן אינן שייכות לדייר, ולכן אין להן `tenant_id` לבודד
-- לפיו. במקום זה: **ל-`bossi_app` אין עליהן שום הרשאה.** הרשאה נבדקת
-- לפני מדיניות, ולכן זה חסם חזק יותר מ-RLS ולא חלש ממנו.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── חיבורי אדמין ─────────────────────────────────────────────────────────

create table platform_sessions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ip            text,
  user_agent    text
);
create index platform_sessions_expiry_idx on platform_sessions (expires_at);

-- ── תיעוד ────────────────────────────────────────────────────────────────
--
-- כל פעולת אדמין וכל ניסיון התחברות שנכשל. הטבלה משרתת שתי מטרות:
-- נתיב ביקורת, ומקור האמת להגבלת קצב — ספירת הכשלונות האחרונים מאותו
-- IP היא בדיוק השאילתה שחוסמת ניחוש סיסמאות.

create table platform_audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  kind        text not null,
  email       text,
  ip          text,
  user_agent  text,
  -- הדייר שהפעולה נגעה בו. NULL = פעולה ברמת הפלטפורמה.
  tenant_id   uuid references tenants(id) on delete set null,
  detail      jsonb not null default '{}'
);
create index platform_audit_at_idx on platform_audit (at desc);
-- השאילתה של הגבלת הקצב: כשלונות מ-IP מסוים בחלון האחרון.
create index platform_audit_failures_idx on platform_audit (ip, at desc)
  where kind = 'login_failed';

do $$
declare t text;
begin
  foreach t in array array['platform_sessions', 'platform_audit'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    -- המדיניות פתוחה, והחסימה היא בהרשאות: `bossi_app` לא מקבל דבר על
    -- הטבלאות האלה, ולכן הוא נחסם עוד לפני שמדיניות נבדקת. מדיניות
    -- `using (false)` הייתה חוסמת גם את נתיב הפלטפורמה עצמו.
    execute format('create policy platform_only on %I using (true) with check (true)', t);
  end loop;
end
$$;

-- שכבה שנייה: גם אם מישהו יעניק הרשאה בטעות בעתיד, הקשר של דייר
-- לעולם לא יראה כאן שורה. `withPlatform` אינו מגדיר `app.tenant_id`,
-- ולכן הוא היחיד שעובר.
do $$
declare t text;
begin
  foreach t in array array['platform_sessions', 'platform_audit'] loop
    execute format(
      'create policy %I on %I as restrictive using (current_tenant() is null)',
      t || '_not_in_tenant_context', t
    );
  end loop;
end
$$;

-- ── התיעוד הוא append-only ───────────────────────────────────────────────
--
-- **טריגר ולא מדיניות.** מדיניות RLS אינה חלה על תפקיד שעוקף RLS, וזה
-- בדיוק התפקיד שנתיב הפלטפורמה רץ תחתיו — כלומר מדיניות כאן הייתה
-- נראית כמו הגנה ולא מונעת דבר. טריגר נורה תמיד, ולכן הוא המנגנון
-- היחיד שבאמת הופך את הטבלה הזו לבלתי ניתנת לשינוי.
--
-- מי שירצה בכל זאת לתקן שורה יצטרך להשבית את הטריגר במפורש — וזו
-- פעולה מודעת שמשאירה עקבות, להבדיל מ-UPDATE שעובר בשקט.

create or replace function platform_audit_immutable() returns trigger
  language plpgsql
as $$
begin
  raise exception 'platform_audit הוא append-only: % נדחה', tg_op
    using errcode = 'insufficient_privilege';
end
$$;

create trigger platform_audit_no_change
  before update or delete on platform_audit
  for each row execute function platform_audit_immutable();

-- המדיניות נשארת כשכבה נוספת, לתפקיד שכפוף ל-RLS.
create policy platform_audit_no_update on platform_audit
  as restrictive for update using (false);
create policy platform_audit_no_delete on platform_audit
  as restrictive for delete using (false);

-- במפורש ובכוונה: אין כאן שום `grant ... to bossi_app`.
-- התפקיד שהאפליקציה רצה תחתיו בהקשר של דייר לא יכול לגעת בטבלאות האלה.

-- ── ניקוי ────────────────────────────────────────────────────────────────

create or replace function platform_purge_expired() returns integer
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  delete from platform_sessions where expires_at < now();
  get diagnostics v_count = row_count;
  -- התיעוד נשמר שנה. אחריה הוא כבר לא ראיה לכלום.
  delete from platform_audit where at < now() - interval '1 year';
  return v_count;
end
$$;

revoke all on function platform_purge_expired() from public;
