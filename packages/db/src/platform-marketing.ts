import { withPlatform } from './client';

/**
 * שיווק הפלטפורמה — איך Bossi עצמה מביאה דיירים משלמים חדשים.
 *
 * לא להתבלבל עם `leads.ts`: זה תיעוד ריטיינר של דייר ללקוחות שלו,
 * שייך לדייר ורץ תחת `withPrincipal`. זה כאן שייך לריאלם הפלטפורמה
 * (0018) — בלי `tenant_id`, רק `withPlatform`, בדיוק כמו `feature-packages.ts`.
 */

// ── קבוצות פייסבוק (אורגני) ────────────────────────────────────────────────

export interface FacebookGroupRow {
  id: string;
  title: string;
  link: string;
  note: string | null;
  created_at: Date;
}

export async function listFacebookGroups(): Promise<FacebookGroupRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<FacebookGroupRow>(
      'select id, title, link, note, created_at from platform_facebook_groups order by created_at desc',
    ),
  );
  return rows;
}

export async function createFacebookGroup(input: { title: string; link: string; note?: string | null }): Promise<string> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ id: string }>(
      'insert into platform_facebook_groups (title, link, note) values ($1, $2, $3) returning id',
      [input.title, input.link, input.note ?? null],
    ),
  );
  return rows[0]!.id;
}

export async function deleteFacebookGroup(id: string): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) => tx.query('delete from platform_facebook_groups where id = $1', [id]));
  return (rowCount ?? 0) > 0;
}

// ── קמפיינים (ממומן) ────────────────────────────────────────────────────────
//
// רשומה לתיעוד בלבד — בלי מדידה אוטומטית, בלי קישור לליד או להמרה.
// ראה ההערה בראש 0018.

export interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  budget: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  created_at: Date;
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<CampaignRow>(
      `select id, name, channel, budget, starts_on, ends_on, notes, created_at
         from platform_campaigns order by coalesce(starts_on, created_at::date) desc, created_at desc`,
    ),
  );
  return rows;
}

export async function createCampaign(input: {
  name: string;
  channel: string;
  budget?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  notes?: string | null;
}): Promise<string> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ id: string }>(
      `insert into platform_campaigns (name, channel, budget, starts_on, ends_on, notes)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [input.name, input.channel, input.budget ?? null, input.startsOn ?? null, input.endsOn ?? null, input.notes ?? null],
    ),
  );
  return rows[0]!.id;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) => tx.query('delete from platform_campaigns where id = $1', [id]));
  return (rowCount ?? 0) > 0;
}

// ── פרוספקטים (Google Places) ───────────────────────────────────────────────
//
// עסקים שיכולים להיות דיירים — לא לקוחות של דייר קיים. בלי pipeline
// שלבים כמו ב-leads (rule 8: לא בונים תשתית על ספק); `contacted` הוא
// הדגל היחיד.

export interface ProspectRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  source: string;
  note: string | null;
  national_id: string | null;
  company_number: string | null;
  contacted: boolean;
  booked_at: Date | null;
  next_follow_up_at: Date | null;
  created_at: Date;
}

const PROSPECT_COLUMNS = `
  id, name, phone, address, website, source, note, national_id, company_number,
  contacted, booked_at, next_follow_up_at, created_at
`;

export async function listProspects(): Promise<ProspectRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<ProspectRow>(
      `select ${PROSPECT_COLUMNS}
         from platform_prospects order by (booked_at is not null), contacted asc, created_at desc`,
    ),
  );
  return rows;
}

/**
 * חיפוש ליד — שם, טלפון, ת"ז או ח"פ. `ILIKE` פשוט על כמה עמודות
 * מספיק בסדר הגודל הזה (עשרות-מאות שורות); אינדקס טריגרם היה תוספת
 * מיותרת לפני שיש נתונים שמצדיקים אותה (rule 8).
 */
export async function searchProspects(term: string): Promise<ProspectRow[]> {
  const like = `%${term}%`;
  const { rows } = await withPlatform((tx) =>
    tx.query<ProspectRow>(
      `select ${PROSPECT_COLUMNS} from platform_prospects
        where name ilike $1 or phone ilike $1 or national_id ilike $1 or company_number ilike $1
        order by (booked_at is not null), contacted asc, created_at desc`,
      [like],
    ),
  );
  return rows;
}

export async function getProspect(id: string): Promise<ProspectRow | null> {
  const { rows } = await withPlatform((tx) =>
    tx.query<ProspectRow>(`select ${PROSPECT_COLUMNS} from platform_prospects where id = $1`, [id]),
  );
  return rows[0] ?? null;
}

/**
 * היעד היחיד שמשנה עכשיו: כמה שיחות מכירה נקבעו **היום**, מכל מקור.
 *
 * `Asia/Jerusalem` ולא `now()::date` גולמי — "היום" של בעל העסק, לא
 * של שרת UTC. הספירה חוצה מקורות בכוונה (Google Places, הפניה, קבוצת
 * פייסבוק) כי היעד הוא שיחות שנקבעו, לא מאיפה הגיעו.
 */
export async function dailyBookedCallCount(): Promise<number> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ n: string }>(
      `select count(*)::text as n from platform_prospects
        where booked_at is not null
          and (booked_at at time zone 'Asia/Jerusalem')::date = (now() at time zone 'Asia/Jerusalem')::date`,
    ),
  );
  return Number(rows[0]?.n ?? 0);
}

export async function createProspect(input: {
  name: string;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  source?: string;
  note?: string | null;
  nationalId?: string | null;
  companyNumber?: string | null;
}): Promise<string> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ id: string }>(
      `insert into platform_prospects (name, phone, address, website, source, note, national_id, company_number)
       values ($1, $2, $3, $4, coalesce($5, 'google_places'), $6, $7, $8) returning id`,
      [
        input.name, input.phone ?? null, input.address ?? null, input.website ?? null, input.source ?? null,
        input.note ?? null, input.nationalId ?? null, input.companyNumber ?? null,
      ],
    ),
  );
  return rows[0]!.id;
}

/** ת"ז/ח"פ מתווספים לרוב אחרי היצירה — כשעסקה מתקדמת ולא בשלב הליד הראשוני. */
export async function setProspectIdentifiers(
  id: string, input: { nationalId?: string | null; companyNumber?: string | null },
): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) =>
    tx.query(
      'update platform_prospects set national_id = $2, company_number = $3 where id = $1',
      [id, input.nationalId ?? null, input.companyNumber ?? null],
    ),
  );
  return (rowCount ?? 0) > 0;
}

/**
 * שמירה אטומית לשדה בודד — לתצוגה מהירה שנשמרת תוך כדי הקלדה, בלי
 * כפתור "שמירה" נפרד. `field` מוגבל לרשימה סגורה שנבדקת בזמן ריצה
 * ולא רק בקומפילציה: לעולם לא להרכיב שם עמודה ממחרוזת שהגיעה בלי
 * בדיקה, גם כשה-caller הוא קוד פנימי.
 */
const EDITABLE_PROSPECT_FIELDS = ['phone', 'address', 'website', 'note', 'national_id', 'company_number'] as const;
export type EditableProspectField = typeof EDITABLE_PROSPECT_FIELDS[number];

export async function updateProspectField(id: string, field: EditableProspectField, value: string | null): Promise<boolean> {
  if (!EDITABLE_PROSPECT_FIELDS.includes(field)) throw new Error(`שדה לא נתמך לעריכה: ${field}`);
  const { rowCount } = await withPlatform((tx) =>
    tx.query(`update platform_prospects set ${field} = $2 where id = $1`, [id, value || null]),
  );
  return (rowCount ?? 0) > 0;
}

export async function setProspectContacted(id: string, contacted: boolean): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) =>
    tx.query('update platform_prospects set contacted = $2 where id = $1', [id, contacted]),
  );
  return (rowCount ?? 0) > 0;
}

/** קביעה/ביטול של "נקבעה שיחה" — `contacted` נדלק אוטומטית איתה, כי אי אפשר לקבוע שיחה בלי ליצור קשר קודם. */
export async function setProspectBooked(id: string, booked: boolean): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) =>
    tx.query(
      `update platform_prospects
          set booked_at = case when $2 then now() else null end,
              contacted = contacted or $2
        where id = $1`,
      [id, booked],
    ),
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteProspect(id: string): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) => tx.query('delete from platform_prospects where id = $1', [id]));
  return (rowCount ?? 0) > 0;
}

/**
 * מתי לחזור — כולל שעה, לא רק תאריך (0021). `null` מנקה. שדה יחיד,
 * כי בכל רגע יש רק "מתי הפעם הבאה". `at` הוא מחרוזת ISO-ish מ-input
 * מסוג `datetime-local` (למשל `2026-09-20T14:30`) — pg מפרש אותה
 * ביחס לאזור הזמן של השרת, שזה בסדר לכלי פנימי של דייר אחד.
 */
export async function setProspectFollowUp(id: string, at: string | null): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) =>
    tx.query('update platform_prospects set next_follow_up_at = $2 where id = $1', [id, at]),
  );
  return (rowCount ?? 0) > 0;
}

/**
 * פולואפים שדורשים תשומת לב **עכשיו** — הגיעו או עברו. ממוין מהדחוף
 * ביותר (הכי מאיחור) לפחות דחוף, כדי שהדבר הראשון ברשימה הוא הדבר
 * הראשון שצריך לטפל בו. זה "החכם" בהתראה: לא רשימה של הכול, רק מה
 * שרלוונטי הרגע — ראה ADR-025.
 */
export async function listDueFollowUps(): Promise<ProspectRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<ProspectRow>(
      `select ${PROSPECT_COLUMNS} from platform_prospects
        where next_follow_up_at is not null and next_follow_up_at <= now()
        order by next_follow_up_at asc`,
    ),
  );
  return rows;
}

// ── תיעוד שיחות ─────────────────────────────────────────────────────────
//
// טבלה נפרדת ולא עוד עמודת טקסט על הפרוספקט — שיחה שנייה לא דורסת את
// התקציר של הראשונה. ראה 0020.

export interface ProspectNoteRow {
  id: string;
  prospect_id: string;
  body: string;
  created_at: Date;
}

export async function listProspectNotes(prospectId: string): Promise<ProspectNoteRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<ProspectNoteRow>(
      'select id, prospect_id, body, created_at from platform_prospect_notes where prospect_id = $1 order by created_at desc',
      [prospectId],
    ),
  );
  return rows;
}

export async function addProspectNote(prospectId: string, body: string): Promise<string> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ id: string }>(
      'insert into platform_prospect_notes (prospect_id, body) values ($1, $2) returning id',
      [prospectId, body],
    ),
  );
  return rows[0]!.id;
}
