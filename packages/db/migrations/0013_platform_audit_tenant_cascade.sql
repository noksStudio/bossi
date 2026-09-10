-- ── באג: append-only חוסם גם את ה-cascade של עצמו ────────────────────────
--
-- `tenant_id` ב-platform_audit הוא `references tenants(id) on delete set
-- null` — מחיקת דייר אמורה לנקות את ההפניה אליו בתיעוד, לא למחוק את
-- התיעוד עצמו. אבל הטריגר מ-0011 חוסם *כל* UPDATE על הטבלה, כולל ה-UPDATE
-- שה-FK עצמו מנפיק. התוצאה: אי אפשר למחוק דייר שיש עליו אפילו שורת תיעוד
-- אחת (כל שינוי מודול, שינוי חבילה או החלת feature package נכתב עם
-- tenant_id) — כולל `pnpm demo:reset`, שמוחק ומזרע מחדש את דיירי הדמו.
--
-- התיקון: מתירים במפורש רק UPDATE שהוא בדיוק ניקוי tenant_id (כל שאר
-- העמודות זהות) — לא פותח פתח לעריכה, רק משחרר את ה-cascade שה-FK כבר
-- מבצע בעצמו.

create or replace function platform_audit_immutable() returns trigger
  language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.tenant_id is null and old.tenant_id is not null
     and new.id = old.id and new.at = old.at and new.kind = old.kind
     and new.email is not distinct from old.email
     and new.ip is not distinct from old.ip
     and new.user_agent is not distinct from old.user_agent
     and new.detail = old.detail
  then
    return new;
  end if;

  raise exception 'platform_audit הוא append-only: % נדחה', tg_op
    using errcode = 'insufficient_privilege';
end
$$;
