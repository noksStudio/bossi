import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, convertLead, createCustomer, createLead, createTenant, deleteLead, dueFollowUps,
  getCustomerDetail, getLead, listLeads, migrate, setLeadFollowUp, setLeadStage, withPlatform, withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

describe.skipIf(!hasDb)('לידים', () => {
  let alpha: string;
  let beta: string;
  let referrer: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
    const stamp = Date.now().toString(36);
    alpha = await createTenant({ slug: `a-${stamp}`, name: 'דייר א', modules: [] });
    beta = await createTenant({ slug: `b-${stamp}`, name: 'דייר ב', modules: [] });

    referrer = await withTenant(alpha, (tx) => createCustomer(tx, { displayName: 'לקוח ותיק — ממליץ' }));
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('יצירת ליד עם הפניה מלקוח קיים', async () => {
    const id = await withTenant(alpha, (tx) =>
      createLead(tx, { displayName: 'עסק פוטנציאלי', source: 'referral', referredByCustomerId: referrer }),
    );
    const lead = await withTenant(alpha, (tx) => getLead(tx, id));
    expect(lead?.display_name).toBe('עסק פוטנציאלי');
    expect(lead?.stage).toBe('new');
    expect(lead?.referred_by_name).toBe('לקוח ותיק — ממליץ');
  });

  it('ליד בלי הפניה — referred_by_name הוא null, לא זורק', async () => {
    const id = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'ליד קר', source: 'cold_outreach' }));
    const lead = await withTenant(alpha, (tx) => getLead(tx, id));
    expect(lead?.referred_by_customer_id).toBeNull();
    expect(lead?.referred_by_name).toBeNull();
  });

  it('שינוי שלב ל-lost דורש שמירת סיבה', async () => {
    const id = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'ליד שנפל' }));
    await withTenant(alpha, (tx) => setLeadStage(tx, id, 'lost', 'לא היה תקציב'));
    const lead = await withTenant(alpha, (tx) => getLead(tx, id));
    expect(lead?.stage).toBe('lost');
    expect(lead?.lost_reason).toBe('לא היה תקציב');
  });

  it('מעבר משלב lost חזרה ל-contacted מנקה את הסיבה', async () => {
    const id = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'ליד שהתעורר' }));
    await withTenant(alpha, (tx) => setLeadStage(tx, id, 'lost', 'לא ענה'));
    await withTenant(alpha, (tx) => setLeadStage(tx, id, 'contacted'));
    const lead = await withTenant(alpha, (tx) => getLead(tx, id));
    expect(lead?.stage).toBe('contacted');
    expect(lead?.lost_reason).toBeNull();
  });

  it('סינון רשימה לפי שלב', async () => {
    const stage = await withTenant(alpha, (tx) => listLeads(tx, { stage: 'lost' }));
    expect(stage.every((l) => l.stage === 'lost')).toBe(true);
  });

  it('convertLead יוצרת לקוח, מקשרת בחזרה, ומעבירה לשלב won', async () => {
    const id = await withTenant(alpha, (tx) =>
      createLead(tx, {
        displayName: 'עסק שממיר', contactName: 'דנה כהן', contactEmail: 'dana@x.co.il', contactPhone: '050-1112222',
      }),
    );
    const result = await withTenant(alpha, (tx) => convertLead(tx, id));
    expect(result).not.toBeNull();

    const lead = await withTenant(alpha, (tx) => getLead(tx, id));
    expect(lead?.stage).toBe('won');
    expect(lead?.converted_customer_id).toBe(result!.customerId);

    const customer = await withTenant(alpha, (tx) => getCustomerDetail(tx, result!.customerId));
    expect(customer?.display_name).toBe('עסק שממיר');
    expect(customer?.contacts).toHaveLength(1);
    expect(customer?.contacts[0]?.name).toBe('דנה כהן');
    expect(customer?.contacts[0]?.is_primary).toBe(true);
  });

  it('convertLead על ליד שכבר won או lost מחזירה null ולא יוצרת כפילות', async () => {
    const id = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'ליד סגור כבר' }));
    await withTenant(alpha, (tx) => setLeadStage(tx, id, 'lost', 'איבד עניין'));
    expect(await withTenant(alpha, (tx) => convertLead(tx, id))).toBeNull();
  });

  it('setLeadFollowUp קובעת ומבטלת תאריך מעקב', async () => {
    const id = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'ליד למעקב' }));
    await withTenant(alpha, (tx) => setLeadFollowUp(tx, id, iso(1)));
    expect((await withTenant(alpha, (tx) => getLead(tx, id)))?.next_follow_up_on).toBe(iso(1));

    await withTenant(alpha, (tx) => setLeadFollowUp(tx, id, null));
    expect((await withTenant(alpha, (tx) => getLead(tx, id)))?.next_follow_up_on).toBeNull();
  });

  it('dueFollowUps מביאה רק לידים חיים שהגיע זמנם, לא עתידיים ולא סגורים', async () => {
    const overdue = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'איחרתי לחזור אליו' }));
    await withTenant(alpha, (tx) => setLeadFollowUp(tx, overdue, iso(-2)));

    const future = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'עוד לא הגיע הזמן' }));
    await withTenant(alpha, (tx) => setLeadFollowUp(tx, future, iso(30)));

    const closedButDue = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'סגור עם תאריך ישן' }));
    await withTenant(alpha, (tx) => setLeadFollowUp(tx, closedButDue, iso(-5)));
    await withTenant(alpha, (tx) => setLeadStage(tx, closedButDue, 'lost', 'נסגר'));

    const due = await withTenant(alpha, (tx) => dueFollowUps(tx));
    const names = due.map((l) => l.display_name);
    expect(names).toContain('איחרתי לחזור אליו');
    expect(names).not.toContain('עוד לא הגיע הזמן');
    expect(names).not.toContain('סגור עם תאריך ישן');
  });

  it('deleteLead מוחקת, ולא נוגעת בליד של דייר אחר', async () => {
    const id = await withTenant(alpha, (tx) => createLead(tx, { displayName: 'למחיקה' }));
    expect(await withTenant(beta, (tx) => deleteLead(tx, id))).toBe(false);
    expect(await withTenant(alpha, (tx) => getLead(tx, id))).not.toBeNull();
    expect(await withTenant(alpha, (tx) => deleteLead(tx, id))).toBe(true);
    expect(await withTenant(alpha, (tx) => getLead(tx, id))).toBeNull();
  });

  it('ליד של דייר אחר אינו נגיש גם עם המזהה המדויק', async () => {
    const id = await withTenant(beta, (tx) => createLead(tx, { displayName: 'ליד של ב' }));
    expect(await withTenant(alpha, (tx) => getLead(tx, id))).toBeNull();
  });

  it('הפניה מלקוח של דייר אחר נכשלת במפתח הזר — לא רק בבידוד', async () => {
    await expect(
      withTenant(beta, (tx) => createLead(tx, { displayName: 'ניסיון הפניה חוצת-דיירים', referredByCustomerId: referrer })),
    ).rejects.toThrow();
  });
});
