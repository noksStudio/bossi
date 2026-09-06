# 02 — מודל הדומיין

## העיקרון הארכיטקטוני: Event Log כעמוד שדרה

ההחלטה החשובה ביותר בבסיס Bossi: **כל דבר שקורה בעסק נכתב כאירוע לטבלה אחת append-only**,
וכל שאר המערכת היא צרכן של הזרם הזה.

```
                    ┌──────────────────────────────┐
                    │        events (append-only)  │
                    │  tenant, actor, subject,     │
                    │  type, payload, occurred_at  │
                    └──────────────┬───────────────┘
                                   │
     ┌──────────────┬──────────────┼──────────────┬──────────────┐
     ▼              ▼              ▼              ▼              ▼
 ציר זמן        מנוע התראות     מנוע גבייה      אינדקס חיפוש    Audit
 של לקוח        (חוקים)         (סולם דחיפה)    (FTS+וקטורים)   (רגולציה)
```

למה זה קריטי:
- **הוספת התראה חדשה לא נוגעת בלוגיקה עסקית.** רק חוק חדש על הזרם.
- **ציר הזמן של הלקוח הוא הפיצ'ר שמוכר את המוצר** — והוא נוצר "בחינם" מהזרם.
- **Audit ואמון** — אתה מחזיק חוזים וכסף של אנשים אחרים. היכולת לענות "מי ראה את המסמך
  הזה ומתי" היא לא נחמדות, היא תנאי סף למכירה לעורך דין או רו"ח.
- **Rebuild** — אינדקס חיפוש שהתקלקל נבנה מחדש מהזרם.

⚠️ זה **לא** Event Sourcing מלא. הטבלאות העסקיות (customers, invoices) הן State רגיל ב-Postgres
ומקור אמת לקריאות. ה-events הן שכבת עובדות מקבילה. Event Sourcing טהור זה מלכודת מורכבות
בשלב הזה.

## הישויות

### ליבה

**Tenant** — העסק. כל שורה בכל טבלה נושאת `tenant_id`. אכיפה ב-Row Level Security, לא בקוד.

**User** — משתמש צוות פנימי. תפקידים: owner, manager, staff, bookkeeper (גישה כספית בלבד).

**PortalUser** — משתמש מצד הלקוח. **ישות נפרדת לחלוטין מ-User**, טבלה נפרדת, טוקן עם
audience נפרד. אסור למזג. אחד הבאגים הכי מסוכנים במערכות כאלה הוא הרשאה שדולפת בין
העולמות.

**Customer** — הלקוח של העסק. שדות ישראליים: ח"פ/ע"מ, סטטוס עוסק, אישור ניכוי מס במקור
(עם תוקף!), תנאי תשלום ברירת מחדל, מסגרת אשראי, אנשי קשר מרובים עם תפקידים
(מי מזמין, מי מאשר, מי משלם — לרוב שלושה אנשים שונים).

**Event** — כל מה שקרה. `type` מ-taxonomy סגור, `subject_type`+`subject_id` להצמדה, `payload` JSONB.

### כסף והתחייבות

**Engagement / Retainer** — ההתקשרות. ראה פירוט מלא ב-[03-modules](03-modules.md#1-ריטיינרים).
תקופה, סכום, מה כלול, מדיניות גלישה, תעריף חריגה, הצמדה, חידוש והודעה מוקדמת.

**RetainerPeriod** — מופע חודשי/רבעוני של הריטיינר. **זו הישות שמחשבים עליה**, לא הריטיינר עצמו.
מכילה: מכסה, נוצל, גלש, סכום שחויב, סטטוס.

**ConsumptionEntry** — יחידת צריכה שנגרעת מהמכסה (שעה, משימה, פריט). מקושרת לאירוע.

**Invoice / Receipt** — מסמך כספי. ב-v1 **מראה** למסמך שהונפק בספק חיצוני (`external_id`,
`provider`), לא מסמך שנוצר כאן.

**Payment** — תקבול. כולל מקור (לינק תשלום, העברה, הו"ק, שיק).

**PromiseToPay** — "אמר שישלם ב-15". ישות ראשונה במעלה, לא הערה. עם תאריך, סכום, ומעקב קיום.

### מוצר ומלאי (שלב B2B)

**Product**, **PriceList**, **CustomerPrice** (מחיר ספציפי ללקוח — ב-B2B אין "מחיר קטלוג"),
**InventoryLevel** (on_hand / allocated / incoming → available-to-promise),
**Order**, **OrderLine**, **Shipment**.

### מסמכים

**Document** — הקובץ. `storage_key`, mime, hash (לזיהוי כפילויות), מקור (email/whatsapp/upload/scan).

**DocumentVersion** — גרסאות. חוזה מתוקן הוא גרסה, לא קובץ חדש.

**DocumentClassification** — סוג (חוזה / הצעת מחיר / חשבונית / תעודת משלוח / אישור ניכוי /
ערבות / ביטוח / תכתובת), **עם ציון ביטחון**. מתחת לסף → תור אישור אנושי.

**ExtractedField** — שדה שחולץ (סכום, תאריך, צד, מספר מסמך), עם ביטחון ועם עוגן למיקום
במסמך (עמוד + bbox) — כדי שאפשר יהיה להראות למה.

**DocumentLink** — קישור פולימורפי בין מסמך לכל ישות (לקוח, ריטיינר, חשבונית, הזמנה).
מסמך אחד יכול להיקשר להרבה — זה בדיוק מה שעושה את "גבייה עם ראיות" אפשרית.

**DocumentExpiry** — תוקף. אישור ניכוי מס, ערבות, ביטוח, חוזה. מזין ישירות את מנוע ההתראות.

**Chunk** — קטע טקסט לחיפוש: `content`, `page`, `section`, `embedding vector`, `tsvector`,
וכן `tenant_id` + `customer_id` **בתוך השורה** — כדי שסינון ההרשאות יקרה בתוך השאילתה
הווקטורית, לא אחריה.

## סכמה — הליבה

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_id text,                    -- ח"פ / ע"מ
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  display_name text not null,
  legal_name text,
  business_id text,
  status text not null default 'active',
  payment_terms_days int not null default 30,
  credit_limit numeric(14,2),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on customers (tenant_id, status);

-- עמוד השדרה
create table events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id),
  occurred_at timestamptz not null default now(),
  type text not null,                  -- 'invoice.overdue', 'retainer.overrun', ...
  actor_type text,                     -- 'user' | 'portal_user' | 'system' | 'integration'
  actor_id uuid,
  customer_id uuid references customers(id),
  subject_type text,
  subject_id uuid,
  payload jsonb not null default '{}'
);
create index on events (tenant_id, customer_id, occurred_at desc);
create index on events (tenant_id, type, occurred_at desc);

create table retainers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  customer_id uuid not null references customers(id),
  name text not null,
  period text not null,                -- 'monthly' | 'quarterly'
  amount numeric(14,2) not null,
  currency text not null default 'ILS',
  quota_unit text,                     -- 'hours' | 'items' | null (scope-based)
  quota_amount numeric(10,2),
  rollover_policy text not null default 'none',   -- none | full | capped
  rollover_cap numeric(10,2),
  overage_rate numeric(10,2),
  indexation text,                     -- 'cpi' | 'fixed_pct' | null
  starts_on date not null,
  ends_on date,
  auto_renew boolean not null default true,
  notice_days int not null default 30,
  status text not null default 'active'
);

create table retainer_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  retainer_id uuid not null references retainers(id),
  period_start date not null,
  period_end date not null,
  quota_amount numeric(10,2),
  carried_in numeric(10,2) not null default 0,
  consumed numeric(10,2) not null default 0,
  overage numeric(10,2) not null default 0,
  billed_amount numeric(14,2),
  status text not null default 'open',
  unique (retainer_id, period_start)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  customer_id uuid references customers(id),
  storage_key text not null,
  filename text not null,
  mime text,
  byte_size bigint,
  content_hash text,
  source text not null,                -- 'email' | 'whatsapp' | 'upload' | 'scan' | 'sync'
  doc_type text,
  doc_type_confidence real,
  status text not null default 'pending',  -- pending | filed | needs_review
  expires_on date,
  created_at timestamptz not null default now()
);
create index on documents (tenant_id, customer_id, created_at desc);
create index on documents (tenant_id, status) where status = 'needs_review';
create index on documents (tenant_id, expires_on) where expires_on is not null;

create table chunks (
  id bigserial primary key,
  tenant_id uuid not null,
  document_id uuid not null references documents(id) on delete cascade,
  customer_id uuid,
  page int,
  content text not null,
  embedding vector(1024),
  ts tsvector generated always as (to_tsvector('simple', content)) stored
);
create index on chunks using hnsw (embedding vector_cosine_ops);
create index on chunks using gin (ts);
create index on chunks (tenant_id, customer_id);
```

## Row Level Security — מהיום הראשון

```sql
alter table customers enable row level security;
create policy tenant_isolation on customers
  using (tenant_id = current_setting('app.tenant_id')::uuid);
```

כל בקשה פותחת טרנזקציה עם `set local app.tenant_id`. **אין דרך אחרת.** בידוד דיירים
שמתבסס על "לא נשכח להוסיף WHERE" הוא דליפה שמחכה לקרות, ובמערכת שמחזיקה חוזים של
עורכי דין — דליפה אחת סוגרת את החברה. להוסיף RLS אחרי שיש 200 שאילתות זה פרויקט של חודשיים.

## Taxonomy של אירועים (התחלה)

```
customer.created / customer.contact_added / customer.went_quiet
document.received / document.classified / document.filed / document.needs_review
document.expiring / document.expired
retainer.started / retainer.consumed / retainer.threshold_crossed
retainer.overrun / retainer.renewal_due / retainer.price_stale
invoice.issued / invoice.due_soon / invoice.overdue / invoice.escalated
payment.received / payment.failed / payment.partial
promise.made / promise.kept / promise.broken
order.placed / order.approved / order.shipped
inventory.low / inventory.out
```

הכלל: `type` הוא מחרוזת מ-enum מתועד. אירוע חדש = שורה בטבלת התיעוד + חוק אופציונלי במנוע ההתראות.
