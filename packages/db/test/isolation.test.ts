import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool,
  createCustomer,
  createTenant,
  customerTimeline,
  enabledModules,
  listCustomers,
  migrate,
  publishEvent,
  withPlatform,
  withTenant,
} from '../src/index';

/**
 * זו הבדיקה שכל השאר נשען עליה.
 *
 * Bossi מחזיקה חוזים וכסף של עסקים אחרים. דליפה אחת בין דיירים סוגרת
 * את החברה — ולכן הבידוד לא נבדק בעין אלא נוסה לשבירה, בכל ריצה.
 */

const hasDb = Boolean(process.env['DATABASE_URL']);
if (!hasDb) console.warn('⚠ DATABASE_URL אינו מוגדר — בדיקות הבידוד מדולגות.');

describe.skipIf(!hasDb)('בידוד דיירים', () => {
  let alpha: string;
  let beta: string;
  let alphaCustomer: string;
  let betaCustomer: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});

    const stamp = Date.now().toString(36);
    alpha = await createTenant({ slug: `alpha-${stamp}`, name: 'דייר א', modules: ['documents'] });
    beta = await createTenant({ slug: `beta-${stamp}`, name: 'דייר ב', modules: ['documents', 'billing'] });

    alphaCustomer = await withTenant(alpha, (tx) =>
      createCustomer(tx, { displayName: 'לקוח של א' }),
    );
    betaCustomer = await withTenant(beta, (tx) =>
      createCustomer(tx, { displayName: 'לקוח של ב' }),
    );
  }, 30_000);

  afterAll(async () => {
    await closePool();
  });

  // ── קריאה ───────────────────────────────────────────────────────────────

  it('דייר רואה רק את הלקוחות שלו', async () => {
    const seenByAlpha = await withTenant(alpha, (tx) => listCustomers(tx));
    expect(seenByAlpha.map((c) => c.display_name)).toEqual(['לקוח של א']);

    const seenByBeta = await withTenant(beta, (tx) => listCustomers(tx));
    expect(seenByBeta.map((c) => c.display_name)).toEqual(['לקוח של ב']);
  });

  it('שליפה לפי מזהה של לקוח מדייר אחר מחזירה כלום — לא שגיאה, כלום', async () => {
    const rows = await withTenant(alpha, async (tx) => {
      const r = await tx.query('select id from customers where id = $1', [betaCustomer]);
      return r.rows;
    });
    expect(rows).toEqual([]);
  });

  it('גם שאילתה בלי שום תנאי לא חוצה דיירים', async () => {
    const { rowCount } = await withTenant(alpha, (tx) => tx.query('select * from customers'));
    expect(rowCount).toBe(1);
  });

  it('בלי מזהה דייר — אפס שורות. כשל סגור, לא כשל פתוח', async () => {
    const rows = await withPlatform(async (tx) => {
      await tx.query('set local role bossi_app');
      const r = await tx.query('select * from customers');
      return r.rows;
    });
    expect(rows).toEqual([]);
  });

  // ── כתיבה ───────────────────────────────────────────────────────────────

  it('אי אפשר לכתוב שורה בשם דייר אחר', async () => {
    await expect(
      withTenant(alpha, (tx) =>
        tx.query('insert into customers (tenant_id, display_name) values ($1, $2)', [
          beta,
          'הברחה',
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('עדכון של שורה מדייר אחר לא נוגע בה', async () => {
    const { rowCount } = await withTenant(alpha, (tx) =>
      tx.query('update customers set display_name = $1 where id = $2', ['נחטף', betaCustomer]),
    );
    expect(rowCount).toBe(0);

    const still = await withTenant(beta, (tx) => listCustomers(tx));
    expect(still[0]!.display_name).toBe('לקוח של ב');
  });

  it('מחיקה של שורה מדייר אחר לא נוגעת בה', async () => {
    const { rowCount } = await withTenant(alpha, (tx) =>
      tx.query('delete from customers where id = $1', [betaCustomer]),
    );
    expect(rowCount).toBe(0);
    expect(await withTenant(beta, (tx) => listCustomers(tx))).toHaveLength(1);
  });

  // בדיקת FK ב-Postgres רצה בנתיב מיוחס ומתעלמת מ-RLS. בלי מפתח זר
  // מודע-דייר, שלוש ההצבעות הבאות היו מצליחות — והיו יוצרות שחיתות
  // רפרנציאלית חוצת דיירים שאף מדיניות לא תופסת.
  it('איש קשר לא יכול להצביע על לקוח של דייר אחר', async () => {
    await expect(
      withTenant(alpha, (tx) =>
        tx.query(
          'insert into contacts (tenant_id, customer_id, name) values (current_tenant(), $1, $2)',
          [betaCustomer, 'איש קשר גנוב'],
        ),
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('אירוע לא יכול להצביע על לקוח של דייר אחר', async () => {
    await expect(
      withTenant(alpha, (tx) => publishEvent(tx, { type: 'documents.filed', customerId: betaCustomer })),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('משתמש פורטל לא יכול להצביע על לקוח של דייר אחר', async () => {
    await expect(
      withTenant(alpha, (tx) =>
        tx.query(
          'insert into portal_users (tenant_id, customer_id, email, name) values (current_tenant(), $1, $2, $3)',
          [betaCustomer, 'x@example.com', 'משתמש גנוב'],
        ),
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  // ── אירועים ─────────────────────────────────────────────────────────────

  it('ציר הזמן מבודד בין דיירים', async () => {
    await withTenant(alpha, (tx) =>
      publishEvent(tx, { type: 'documents.filed', customerId: alphaCustomer, payload: { n: 1 } }),
    );
    await withTenant(beta, (tx) =>
      publishEvent(tx, { type: 'documents.filed', customerId: betaCustomer, payload: { n: 2 } }),
    );

    const alphaTimeline = await withTenant(alpha, (tx) => customerTimeline(tx, alphaCustomer));
    expect(alphaTimeline).toHaveLength(1);
    expect(alphaTimeline[0]!.payload).toEqual({ n: 1 });

    const crossRead = await withTenant(alpha, (tx) => customerTimeline(tx, betaCustomer));
    expect(crossRead).toEqual([]);
  });

  it('אירועים הם append-only — אין UPDATE ואין DELETE', async () => {
    await expect(
      withTenant(alpha, (tx) => tx.query("update events set type = 'tampered.event'")),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withTenant(alpha, (tx) => tx.query('delete from events')),
    ).rejects.toThrow(/permission denied/i);
  });

  it('סוג אירוע ללא מרחב שם נדחה', async () => {
    await expect(
      withTenant(alpha, (tx) => publishEvent(tx, { type: 'bare' })),
    ).rejects.toThrow(/לא תקין/);
  });

  // ── מודולים ─────────────────────────────────────────────────────────────

  it('לכל דייר ההרכבה שלו', async () => {
    expect(await withTenant(alpha, (tx) => enabledModules(tx))).toEqual(['documents']);
    expect(await withTenant(beta, (tx) => enabledModules(tx))).toEqual(['billing', 'documents']);
  });

  it('דייר לא יכול ליצור או לשנות דיירים', async () => {
    await expect(
      withTenant(alpha, (tx) =>
        tx.query("insert into tenants (slug, name) values ('sneaky', 'דייר מזויף')"),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withTenant(alpha, (tx) => tx.query("update tenants set name = 'נחטף'")),
    ).rejects.toThrow(/permission denied/i);
  });

  it('דייר רואה רק את שורת הדייר של עצמו', async () => {
    const rows = await withTenant(alpha, (tx) => tx.query<{ id: string }>('select id from tenants'));
    expect(rows.rows.map((r) => r.id)).toEqual([alpha]);
  });

  // ── דליפה בין בקשות ─────────────────────────────────────────────────────

  it('מזהה הדייר לא דולף לבקשה הבאה שמקבלת את אותו חיבור', async () => {
    await withTenant(alpha, (tx) => listCustomers(tx));

    const leaked = await withPlatform(async (tx) => {
      const r = await tx.query<{ t: string | null }>("select current_setting('app.tenant_id', true) as t");
      return r.rows[0]!.t;
    });
    expect(leaked === null || leaked === '').toBe(true);
  });

  it('מזהה דייר שאינו UUID נדחה לפני שהוא מגיע למסד', async () => {
    await expect(withTenant("'; drop table customers; --", async () => 1)).rejects.toThrow(
      /לא תקין/,
    );
  });
});
