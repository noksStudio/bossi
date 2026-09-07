-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 · זהות המשתמש במסד, הערות והרשאות
--
-- עד כה המסד ידע איזה **דייר** מבצע פעולה, אבל לא מי בתוכו. זה הספיק
-- לבידוד, אבל לא להרשאות: הכלל "רק הבעלים מוחק הערות" היה נאכף בקוד
-- ה-UI בלבד, כלומר לא נאכף.
--
-- מכאן `withPrincipal` מעביר גם את המשתמש ואת תפקידו, ומדיניות RESTRICTIVE
-- אוכפת את המחיקה במסד. גם קריאה ישירה שעוקפת את הממשק תיכשל.
--
-- RESTRICTIVE ולא PERMISSIVE: מדיניות מתירה נוספת הייתה מתווספת ב-OR
-- ופותחת את המחיקה לכולם. מדיניות מגבילה מתווספת ב-AND.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function current_user_id() returns uuid
  language sql stable
  set search_path = pg_catalog, public
as $$ select nullif(current_setting('app.user_id', true), '')::uuid; $$;

create or replace function current_user_role() returns text
  language sql stable
  set search_path = pg_catalog, public
as $$ select nullif(current_setting('app.user_role', true), ''); $$;

comment on function current_user_role() is
  'תפקיד המשתמש בטרנזקציה. NULL בהקשר מערכת (עבודות רקע, seed) — ולכן
   כל מדיניות שנשענת עליו נכשלת סגור.';

grant execute on function current_user_id(), current_user_role() to bossi_app;

-- ── הערות · תיקיית הלקוח ─────────────────────────────────────────────────
--
-- הערה יכולה לעמוד בפני עצמה על הלקוח, או להיצמד לישות מסוימת —
-- צ'ק, חוזה או מסמך. `subject_type`/`subject_id` פולימורפיים בכוונה,
-- כדי שמודול חדש יוכל להיתלות עליהן בלי מיגרציה.

create table notes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid,
  subject_type  text,
  subject_id    uuid,
  body          text not null,
  author_id     uuid,
  pinned        boolean not null default false,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  constraint notes_body_not_empty check (length(btrim(body)) > 0),
  constraint notes_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  constraint notes_author_fk
    foreign key (tenant_id, author_id) references users (tenant_id, id) on delete set null (author_id)
);
create index notes_customer_idx on notes (tenant_id, customer_id, created_at desc);
create index notes_subject_idx on notes (tenant_id, subject_type, subject_id);

alter table notes enable row level security;
alter table notes force row level security;

create policy tenant_isolation on notes
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

-- הכלל של ראובן: עובדים כותבים, רק הבעלים מוחק.
create policy notes_delete_owner_only on notes
  as restrictive for delete
  using (current_user_role() = 'owner');

-- עריכה מותרת לכותב עצמו או לבעלים — עובד לא משכתב הערה של אחר.
create policy notes_update_author_or_owner on notes
  as restrictive for update
  using (current_user_role() = 'owner' or author_id = current_user_id());

grant select, insert, update, delete on notes to bossi_app;

-- ── הרשאות פר-משתמש ──────────────────────────────────────────────────────
--
-- התפקיד הוא ברירת המחדל; הטבלה הזו היא חריגים בלבד. עסק עם ארבעה
-- עובדים לא צריך מטריצת הרשאות מלאה, הוא צריך "למזכירה מותר גם לסמן
-- צ'קים".

create table user_permissions (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid not null,
  permission    text not null,
  granted       boolean not null,
  created_at    timestamptz not null default now(),
  primary key (tenant_id, user_id, permission),
  constraint user_permissions_user_fk
    foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);

alter table user_permissions enable row level security;
alter table user_permissions force row level security;
create policy tenant_isolation on user_permissions
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

-- רק הבעלים משנה הרשאות. גם מנהל לא מעניק לעצמו.
create policy permissions_write_owner_only on user_permissions
  as restrictive for all
  using (current_user_role() = 'owner' or current_setting('app.user_role', true) is null)
  with check (current_user_role() = 'owner');

grant select, insert, update, delete on user_permissions to bossi_app;
