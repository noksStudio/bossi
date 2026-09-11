-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 · "נקבעה שיחה" על פרוספקט
--
-- `contacted` (0018) אומר "יצרתי קשר" — לא אומר שנקבעה שיחת מכירה.
-- היעד הממוקד עכשיו הוא ספירה יומית של שיחות שנקבעו בפועל, ולכן צריך
-- שלב נפרד: `booked_at`. NULL = לא נקבעה עדיין; timestamptz = מתי.
--
-- עמודת תאריך ולא boolean, מאותה סיבה בדיוק שדברים אחרים במסד הם
-- timestamptz ולא boolean+created_at נפרד: "מתי" הוא המידע, לא רק "כן/לא".
-- ═══════════════════════════════════════════════════════════════════════════

alter table platform_prospects add column booked_at timestamptz;
create index platform_prospects_booked_idx on platform_prospects (booked_at);
