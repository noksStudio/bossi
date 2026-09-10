-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 · חבילות תכונה
--
-- שכבה שלישית מעל המודולים, ברמת הפלטפורמה: לא "מה יש ללקוח" (זה
-- `tenant_modules`, פר-דייר) ולא "כמה משלמים ל-Bossi" (זה `PLANS`
-- בקוד — ציר תמחור נפרד לגמרי, ADR מוקדם). זו שכבת **תבנית**: שם
-- בעל משמעות עסקית ("חבילת עורך דין 1", "ראובן מסיקה נכסים") שמצביע
-- על רשימת מודולים, ואפשר לבחור אותו כבסיס כשמקימים דייר חדש —
-- בלי לכתוב שורת קוד ובלי דיפלוי.
--
-- `PRESETS` הקבועים בקוד (`packages/kernel/src/presets.ts`) הופכים
-- כאן לנתוני זרע — ברירות המחדל שכל התקנה מתחילה איתן. הם לא נמחקים
-- מהקוד: `pnpm modules` וה-CLI עדיין משתמשים בהם ישירות בלי מסד.
--
-- **`module_ids` הוא מערך, לא טבלת קישור.** קבוצת המודולים חסומה
-- וקטנה (14 היום, גדלה באיטיות) — בדיוק המקרה שבשבילו יש בסכמה הזו
-- כבר `customers.tags` ו-`portal_users.permissions` כ-`text[]`. טבלת
-- קישור נפרדת הייתה עקביות מדומה בלי תועלת אמיתית בסדר הגודל הזה.
--
-- **אין קישור בין חבילה לדייר שמשתמש בה.** להחיל חבילה זו כתיבה
-- מרוכזת ל-`tenant_modules` (הבעלים האמיתי של "מה דלוק אצל מי"),
-- לא הפניה. חבילה שאף דייר לא משתמש בה עוד היא סתם שורה — לא בעיית
-- מפתח זר. מי החיל מה ומתי נגזר מ-`platform_audit`, לא משוכפל כאן.
--
-- הריאלם: כמו `platform_sessions`/`platform_audit` (0011) — בלי
-- `tenant_id`, בלי גישה מ-`bossi_app`, רק `withPlatform`. מי שמנהל
-- דיירים אחרים לא צריך ולא אמור לגעת בזה.
-- ═══════════════════════════════════════════════════════════════════════════

create table feature_packages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  name          text not null,
  description   text,
  module_ids    text[] not null default '{}',
  -- true = תבנית לשימוש חוזר ("חבילת עורך דין 1"), מוצעת כבסיס בכל
  -- הקמת דייר. false = הרכבה חד-פעמית ("ייחודי איציק כהן") — קיימת
  -- לתיעוד ולעריכה עתידית, לא מוצגת כברירת מחדל למישהו אחר.
  is_template   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint feature_packages_slug_uq unique (slug)
);
create index feature_packages_template_idx on feature_packages (is_template);

alter table feature_packages enable row level security;
alter table feature_packages force row level security;
create policy feature_packages_platform_only on feature_packages using (true) with check (true);
-- הגנה כפולה: גם אם תוענק אי-פעם הרשאה בטעות, הקשר של דייר עדיין
-- לא רואה כאן שורה — ראה ההערה המקבילה ב-0011.
create policy feature_packages_not_in_tenant_context on feature_packages
  as restrictive using (current_tenant() is null);

-- במפורש ובכוונה: אין `grant ... to bossi_app`, כמו ב-0011.
