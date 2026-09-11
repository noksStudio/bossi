-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 · תיקון 0015: SET NULL על leads חייב רשימת עמודות
--
-- הבאג (נתפס באימות ידני, לא בבדיקה): שני ה-FK המורכבים ב-0015
-- (`leads_referred_by_fk`, `leads_converted_customer_fk`) הוגדרו עם
-- `on delete set null` בלי רשימת עמודות — התחביר הזה מאפס **את כל**
-- עמודות ה-FK, כולל `tenant_id` שהוא `not null`. מחיקת לקוח שהיה
-- מפנה/הומר-אליו הפילה `leads` עם "null value in column tenant_id".
--
-- אותו באג בדיוק שכבר תועד ומנוע במפורש ב-0001 (`events_customer_fk`,
-- ראו ההערה שם): "רשימת העמודות ב-SET NULL היא תחביר של Postgres 15+,
-- ומונעת ניסיון לאפס גם את tenant_id". כאן פשוט נשכח ליישם את אותו
-- לקח בטבלה חדשה. מיגרציה חדשה, לא עריכה של 0015 — קדימה בלבד
-- (כלל ברזל 0, ראו ADR-012 לאותו דפוס תיקון בדיוק).
-- ═══════════════════════════════════════════════════════════════════════════

alter table leads drop constraint leads_referred_by_fk;
alter table leads drop constraint leads_converted_customer_fk;

alter table leads
  add constraint leads_referred_by_fk
  foreign key (tenant_id, referred_by_customer_id) references customers (tenant_id, id)
  on delete set null (referred_by_customer_id);

alter table leads
  add constraint leads_converted_customer_fk
  foreign key (tenant_id, converted_customer_id) references customers (tenant_id, id)
  on delete set null (converted_customer_id);
