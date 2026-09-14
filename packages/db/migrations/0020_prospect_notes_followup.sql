-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 · מה קרה בשיחה, ומתי לחזור
--
-- `platform_prospects` (0018) ידע רק "נוצר קשר / לא" ו"נקבעה שיחה" (0019) —
-- שני דגלים, בלי לתעד מה בכלל קרה בשיחה או מתי לחזור אליה. בשימוש בפועל
-- זה חסר: אחרי חיוג צריך לרשום תקציר, ולקבוע תאריך לחזרה.
--
-- `next_follow_up_at` על הפרוספקט עצמו — שדה יחיד, כי בכל רגע יש רק
-- "מתי הפעם הבאה", לא היסטוריה של תאריכים. `platform_prospect_notes`
-- טבלה נפרדת ולא עוד עמודת טקסט על הפרוספקט, כי שיחה שנייה ושלישית
-- צריכות תיעוד נפרד ולא לדרוס את הראשונה — בדיוק הסיבה ש-`notes`
-- (0007) היא טבלה נפרדת אצל דייר ולא עמודה על הישות.
--
-- FK רגיל ל-`platform_prospects`, לא מורכב עם tenant_id — כי הריאלם
-- הזה כולו בלי tenant_id מלכתחילה (ADR-005 חל רק על ישויות של דייר).
-- אותו דפוס RLS בדיוק כמו שאר טבלאות 0018.
-- ═══════════════════════════════════════════════════════════════════════════

alter table platform_prospects add column next_follow_up_at date;
create index platform_prospects_followup_idx on platform_prospects (next_follow_up_at);

create table platform_prospect_notes (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references platform_prospects(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index platform_prospect_notes_prospect_idx on platform_prospect_notes (prospect_id, created_at desc);

alter table platform_prospect_notes enable row level security;
alter table platform_prospect_notes force row level security;
create policy platform_only on platform_prospect_notes using (true) with check (true);
create policy platform_prospect_notes_not_in_tenant_context on platform_prospect_notes
  as restrictive using (current_tenant() is null);

-- במפורש ובכוונה: אין כאן שום `grant ... to bossi_app`, כמו 0018/0011.
