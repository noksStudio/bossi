-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 · מסמכים
--
-- הישות שהופכת את ציר הזמן ממשהו ריק למשהו שווה כניסה יומית.
--
-- שתי החלטות שנשמרות מכאן:
--   · `title` נפרד מ-`filename`. הקובץ נקרא IMG_4471.jpg; המסמך הוא
--     "תעודת משלוח 4471". המשתמש מחפש את השני.
--   · `expires_on` הוא עמודה ולא נגזרת. אישור ניכוי מס, ערבות וביטוח
--     הם מסמכים חיים, והתוקף שלהם מזין את ההתראות.
-- ═══════════════════════════════════════════════════════════════════════════

create table documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  customer_id         uuid,
  title               text not null,
  filename            text not null,
  mime                text not null default 'application/pdf',
  byte_size           bigint,
  -- מפתח האחסון. `demo:<path>` מוגש מקבצים סטטיים; כל השאר מ-R2 ב-signed URL.
  storage_key         text not null,
  content_hash        text,
  source              text not null default 'upload',
  doc_type            text,
  doc_type_confidence real,
  status              text not null default 'filed',
  issued_on           date,
  expires_on          date,
  amount              numeric(14, 2),
  currency            text not null default 'ILS',
  created_at          timestamptz not null default now(),

  constraint documents_source_known
    check (source in ('upload', 'email', 'whatsapp', 'scan', 'sync')),
  constraint documents_status_known
    check (status in ('filed', 'needs_review', 'processing', 'archived')),
  constraint documents_customer_fk
    foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete set null (customer_id),
  constraint documents_tenant_id_uq unique (tenant_id, id)
);

create index documents_customer_idx on documents (tenant_id, customer_id, created_at desc);
create index documents_recent_idx on documents (tenant_id, created_at desc);
create index documents_review_idx on documents (tenant_id) where status = 'needs_review';
create index documents_expiry_idx on documents (tenant_id, expires_on) where expires_on is not null;
create index documents_title_trgm_idx on documents using gin (title gin_trgm_ops);

-- אין קונפיגורציית עברית ב-Postgres, ולכן `simple` (בלי גזירת שורש) יחד עם
-- trigram. חיפוש סמנטי נכנס בספרינט 11 ולא מחליף את שני אלה אלא מצטרף להם.
alter table documents add column search_text tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(doc_type, '') || ' ' || coalesce(filename, ''))
  ) stored;
create index documents_search_idx on documents using gin (search_text);

-- מסמך אחד יכול לשמש ראיה לכמה ישויות: חוזה נקשר ללקוח, לריטיינר
-- ולחשבונית. זה מה שיאפשר בהמשך לצרף ראיות לתזכורת גבייה אוטומטית.
create table document_links (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  document_id   uuid not null,
  subject_type  text not null,
  subject_id    uuid not null,
  created_at    timestamptz not null default now(),
  constraint document_links_document_fk
    foreign key (tenant_id, document_id) references documents (tenant_id, id) on delete cascade,
  unique (tenant_id, document_id, subject_type, subject_id)
);
create index document_links_subject_idx on document_links (tenant_id, subject_type, subject_id);

do $$
declare t text;
begin
  foreach t in array array['documents', 'document_links'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end
$$;

grant select, insert, update, delete on documents, document_links to bossi_app;

-- דייר דמו: מסומן במסד ולא רק בהגדרות, כדי שכניסת הדמו לא תוכל
-- להגיע לדייר אמיתי גם אם משתנה סביבה יוגדר בטעות.
alter table tenants add column is_demo boolean not null default false;
