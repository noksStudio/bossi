-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 · שיווק הפלטפורמה
--
-- לא לידים של דייר (זה `leads`, 0015 — עסק כמו "לביא ושות'" מוצא את
-- הלקוחות שלו). זה הפוך: Bossi עצמה מוצאת דיירים משלמים חדשים. שלושה
-- ריכוזים, כל אחד ליעד אחר בתיקיית /admin/marketing:
--
--   platform_facebook_groups — ערוץ אורגני. רשימה בלבד (כותרת+לינק).
--     בלי פרסום אוטומטי לקבוצה — זה איסוף כתובות ליזום ידני, בדיוק
--     כמו ש-Google Places לא שולח הודעה בעצמו (ADR-020).
--   platform_campaigns — רשומת תיעוד לערוץ ממומן (שם/ערוץ/תקציב/טווח
--     תאריכים/הערות). **בלי מדידה אוטומטית** — אין קישור לליד, אין
--     ספירת המרות. זו החלטה מפורשת, לא פער: המדידה תגיע כ-ADR נפרד
--     אם וכשתהיה תשתית מעקב אמיתית (UTM, פיקסל וכו').
--   platform_prospects — תוצאות Google Places שנשמרו: עסקים שיכולים
--     להיות דיירים, לא לקוחות של דייר קיים. `contacted` הוא הדגל
--     היחיד — אין כאן pipeline שלבים כמו ב-leads, כי זה עדיין לא שוק
--     מספיק גדול כדי להצדיק את זה (rule 8: לא בונים על ספק).
--
-- הריאלם: כמו `platform_sessions`/`platform_audit`/`feature_packages`
-- (0011, 0012) — בלי `tenant_id`, בלי גישה מ-`bossi_app`, רק
-- `withPlatform`. מידע על השיווק של Bossi עצמה לא שייך לשום דייר.
-- ═══════════════════════════════════════════════════════════════════════════

create table platform_facebook_groups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  link        text not null,
  note        text,
  created_at  timestamptz not null default now()
);

create table platform_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  channel     text not null,
  budget      numeric(14,2),
  starts_on   date,
  ends_on     date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table platform_prospects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  website     text,
  -- מקור חופשי, לא constrained — היום רק 'google_places', אבל אין
  -- טעם לנעול רשימה סגורה על עמודה שמתעדת מאיפה הגיע רישום ידני.
  source      text not null default 'google_places',
  note        text,
  contacted   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index platform_prospects_contacted_idx on platform_prospects (contacted, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['platform_facebook_groups', 'platform_campaigns', 'platform_prospects'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy platform_only on %I using (true) with check (true)', t);
    execute format(
      'create policy %I on %I as restrictive using (current_tenant() is null)',
      t || '_not_in_tenant_context', t
    );
  end loop;
end
$$;

-- במפורש ובכוונה: אין כאן שום `grant ... to bossi_app`, כמו ב-0011/0012.
