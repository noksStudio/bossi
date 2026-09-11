import type { Tx } from './client';
import { createContact, createCustomer } from './repositories';

/**
 * ליד — לא לקוח. שלבי pipeline אמיתיים, ולא בהכרח הופך ללקוח בסוף
 * (stage 'lost'). המרה ל-customer היא פעולה מפורשת (`convertLead`),
 * לא נגזרת אוטומטית משלב — ראו migration 0015.
 */

export const LEAD_STAGES = {
  new: 'חדש',
  contacted: 'יצרנו קשר',
  qualified: 'מוכשר',
  proposal: 'הצעה נשלחה',
  won: 'נסגר בהצלחה',
  lost: 'לא התקדם',
} as const;

export type LeadStage = keyof typeof LEAD_STAGES;

/**
 * תוויות מקור — לא נאכף במסד (leads.source פתוח בכוונה, ראו המיגרציה)
 * כדי שערוץ שיווק חדש לא ידרוש מיגרציה, רק ערך חדש כאן.
 */
export const LEAD_SOURCES = {
  referral: 'הפניה',
  warm_network: 'רשת חמה (לקוח/קשר קיים)',
  cold_outreach: 'פנייה קרה',
  facebook_group: 'קבוצת פייסבוק',
  linkedin: 'LinkedIn',
  google_places: 'Google Places',
  website: 'אתר',
  other: 'אחר',
} as const;

export interface LeadRow {
  id: string;
  display_name: string;
  stage: LeadStage;
  source: string | null;
  referred_by_customer_id: string | null;
  referred_by_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  next_follow_up_on: string | null;
  converted_customer_id: string | null;
  converted_customer_name: string | null;
  lost_reason: string | null;
  created_at: Date;
}

const SELECT = `
  select l.id, l.display_name, l.stage, l.source, l.referred_by_customer_id,
         r.display_name as referred_by_name, l.contact_name, l.contact_email,
         l.contact_phone, l.next_follow_up_on::text, l.converted_customer_id,
         cv.display_name as converted_customer_name, l.lost_reason, l.created_at
    from leads l
    left join customers r on r.id = l.referred_by_customer_id
    left join customers cv on cv.id = l.converted_customer_id
`;

export interface LeadFilters {
  stage?: LeadStage;
  search?: string;
  limit?: number;
}

export async function listLeads(tx: Tx, f: LeadFilters = {}): Promise<LeadRow[]> {
  const { rows } = await tx.query<LeadRow>(
    `${SELECT}
      where ($1::text is null or l.stage = $1)
        and ($2::text is null or l.display_name ilike '%' || $2 || '%')
      order by l.created_at desc
      limit $3`,
    [f.stage ?? null, f.search?.trim() || null, f.limit ?? 100],
  );
  return rows;
}

export async function getLead(tx: Tx, id: string): Promise<LeadRow | null> {
  const { rows } = await tx.query<LeadRow>(`${SELECT} where l.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createLead(
  tx: Tx,
  input: {
    displayName: string;
    source?: string | null;
    referredByCustomerId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    nextFollowUpOn?: string | null;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into leads
       (tenant_id, display_name, source, referred_by_customer_id,
        contact_name, contact_email, contact_phone, next_follow_up_on)
     values (current_tenant(), $1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.displayName,
      input.source ?? null,
      input.referredByCustomerId ?? null,
      input.contactName ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      input.nextFollowUpOn ?? null,
    ],
  );
  return rows[0]!.id;
}

/**
 * שינוי שלב. 'lost' דורש סיבה (אחרת אין ערך לדעת "למה" בעוד חודש);
 * מעבר ל-won לא קורה כאן — זו פעולת `convertLead` הנפרדת, כי מעבר
 * ל-won בלי ליצור לקוח בפועל הוא מצב לא עקבי.
 */
export async function setLeadStage(
  tx: Tx,
  id: string,
  stage: Exclude<LeadStage, 'won'>,
  lostReason?: string | null,
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update leads set stage = $2, lost_reason = case when $2 = 'lost' then $3 else null end
      where id = $1`,
    [id, stage, lostReason ?? null],
  );
  return (rowCount ?? 0) > 0;
}

export async function setLeadFollowUp(tx: Tx, id: string, nextFollowUpOn: string | null): Promise<boolean> {
  const { rowCount } = await tx.query('update leads set next_follow_up_on = $2 where id = $1', [id, nextFollowUpOn]);
  return (rowCount ?? 0) > 0;
}

/**
 * המרה ללקוח: יוצרת רשומת customers (+ איש קשר ראשי אם יש פרטי קשר),
 * מקשרת בחזרה, ומעבירה שלב ל-won. פעולה אחת, לא ניתנת לביטול חלקי —
 * אם הלקוח נוצר, הליד תמיד יסומן won ומקושר, לא משאיר מצב ביניים.
 */
export async function convertLead(tx: Tx, id: string): Promise<{ customerId: string } | null> {
  const lead = await getLead(tx, id);
  if (!lead || lead.stage === 'won' || lead.stage === 'lost') return null;

  const customerId = await createCustomer(tx, { displayName: lead.display_name, status: 'active' });

  if (lead.contact_name) {
    await createContact(tx, {
      customerId, name: lead.contact_name, email: lead.contact_email, phone: lead.contact_phone, isPrimary: true,
    });
  }

  await tx.query(
    "update leads set stage = 'won', converted_customer_id = $2, lost_reason = null where id = $1",
    [id, customerId],
  );

  return { customerId };
}

export async function deleteLead(tx: Tx, id: string): Promise<boolean> {
  const { rowCount } = await tx.query('delete from leads where id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

/** לידים חיים שהגיע זמן המעקב שלהם — מזין את "היום" בדשבורד. */
export async function dueFollowUps(tx: Tx, limit = 20): Promise<LeadRow[]> {
  const { rows } = await tx.query<LeadRow>(
    `${SELECT}
      where l.stage not in ('won', 'lost')
        and l.next_follow_up_on is not null
        and l.next_follow_up_on <= current_date
      order by l.next_follow_up_on
      limit $1`,
    [limit],
  );
  return rows;
}
