-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 · שלב ייצור על שורת הזמנה
--
-- לעסקי ייצור (למשל בית מלאכה לבדים) שורת הזמנה היא לא רק "מה הוזמן",
-- אלא גם "מה שלב העבודה עליה" — צבע וסוג עבודה שהמשרד קובע בזמן
-- ההזמנה, ומעקב שלב שמתקדם על הרצפה: התחלה → לקראת סיום → מוכן.
--
-- זו הרחבה של `order_lines` הקיימת, לא מודול חדש: שלב הייצור הוא
-- תכונה של השורה עצמה, באותה טבלה שכבר בבעלות מודול `orders`
-- (0010) — בדיוק כמו שסטטוס ההזמנה הוא עמודה על `orders`, לא ישות
-- נפרדת.
--
-- `ready_at`/`notified_at` נפרדים בכוונה: "מוכן" ו"הלקוח יודע שמוכן"
-- הם שני רגעים שונים — הראשון קורה ברצפת הייצור, השני כשמישהו במשרד
-- לוחץ על כפתור הוואטסאפ. בלי ההפרדה אי אפשר להראות "מוכן וממתין
-- ליידוע" בלוח הבקרה.
-- ═══════════════════════════════════════════════════════════════════════════

alter table order_lines add column color text;
alter table order_lines add column job_type text;
alter table order_lines add column production_stage text not null default 'started';
alter table order_lines add column ready_at timestamptz;
alter table order_lines add column notified_at timestamptz;

alter table order_lines add constraint order_lines_production_stage_known
  check (production_stage in ('started', 'near_completion', 'ready'));
