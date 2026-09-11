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
  contacted: boolean;
  booked_at: Date | null;
  created_at: Date;
}

export async function listProspects(): Promise<ProspectRow[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<ProspectRow>(
      `select id, name, phone, address, website, source, note, contacted, booked_at, created_at
         from platform_prospects order by (booked_at is not null), contacted asc, created_at desc`,
    ),
  );
  return rows;
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
}): Promise<string> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ id: string }>(
      `insert into platform_prospects (name, phone, address, website, source, note)
       values ($1, $2, $3, $4, coalesce($5, 'google_places'), $6) returning id`,
      [input.name, input.phone ?? null, input.address ?? null, input.website ?? null, input.source ?? null, input.note ?? null],
    ),
  );
  return rows[0]!.id;
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
