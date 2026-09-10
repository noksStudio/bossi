-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 · קישורי שיתוף למסמכים
--
-- כפתור "שיתוף" על מסמך מנפיק קישור שאדם בלי חשבון Bossi בכלל יכול
-- לפתוח — לקוח שמבקש עותק של האישור שלו, למשל. זו בדיוק אותה בעיה
-- שפותרת auth.ts (0004): הבקשה מגיעה עם אסימון, ולפני שפענחנו אותו
-- אנחנו לא יודעים אפילו את הדייר, ולכן withTenant()/withPrincipal()
-- לא ישימים עדיין. הפתרון זהה: פונקציית SECURITY DEFINER צרה אחת,
-- שעושה בדיוק דבר אחד ומחזירה בדיוק את מה שדרוש כדי להגיש את הקובץ —
-- לא יותר. זו לא חריגה חדשה מכלל 1ב, אלא אותו פתח המנוצל בשנית.
--
-- קישור פעיל = יכולת לצפות במסמך אחד, בלי זהות. לכן אין כאן "מי צפה"
-- מעבר למונה וזמן אחרון — את זה `platform_audit`/`events` לא פותרים
-- (אין principal), וספירה גולמית מספיקה כדי לדעת שהקישור בשימוש.
-- ═══════════════════════════════════════════════════════════════════════════

create table document_shares (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  document_id     uuid not null,
  token_hash      text not null unique,
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  last_viewed_at  timestamptz,
  view_count      integer not null default 0,

  constraint document_shares_document_fk
    foreign key (tenant_id, document_id) references documents (tenant_id, id) on delete cascade,
  constraint document_shares_user_fk
    foreign key (tenant_id, created_by) references users (tenant_id, id) on delete cascade
);
create index document_shares_document_idx on document_shares (tenant_id, document_id);
-- הניקוי התקופתי: קישורים שפגו ולא בוטלו כבר לא רלוונטיים.
create index document_shares_expiry_idx on document_shares (expires_at) where revoked_at is null;

alter table document_shares enable row level security;
alter table document_shares force row level security;
create policy tenant_isolation on document_shares
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

-- הצוות יוצר ומבטל קישורים דרך withPrincipal הרגיל — לא דרך הפונקציה
-- הצרה למטה, שמיועדת אך ורק לצופה האנונימי בצד השני של הקישור.
grant select, insert, update on document_shares to bossi_app;

-- ── פענוח הקישור ─────────────────────────────────────────────────────────

/**
 * הופכת אסימון גולמי (מגיע מ-`/s/<token>`, עוד לפני שידוע הדייר) למה
 * שדרוש כדי להגיש את הקובץ — לא יותר. מעדכנת מונה צפייה כתוצאת לוואי,
 * לא כמטרה: זה כל ה"ביקורת" שיש לקישור אנונימי.
 */
create or replace function share_resolve_token(p_token_hash text)
  returns table (
    tenant_id     uuid,
    document_id   uuid,
    title         text,
    filename      text,
    mime          text,
    byte_size     bigint,
    storage_key   text,
    expires_at    timestamptz
  )
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
begin
  update document_shares
     set last_viewed_at = now(), view_count = view_count + 1
   where document_shares.token_hash = p_token_hash
     and revoked_at is null
     and document_shares.expires_at > now();

  return query
    select s.tenant_id, d.id, d.title, d.filename, d.mime, d.byte_size, d.storage_key, s.expires_at
      from document_shares s
      join documents d on d.id = s.document_id and d.tenant_id = s.tenant_id
     where s.token_hash = p_token_hash
       and s.revoked_at is null
       and s.expires_at > now();
end
$$;

revoke all on function share_resolve_token(text) from public;

/** ניקוי תקופתי — אין טעם לגרור קישורים שפגו מזמן. */
create or replace function share_purge_expired() returns integer
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  delete from document_shares where expires_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function share_purge_expired() from public;
