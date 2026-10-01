import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createProspect, findProspectByPhone, migrate, updateProspectField, withPlatform,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);

/**
 * ליד אחד לכל מספר טלפון (0024). נבדק דרך שכבת הנתונים ודרך SQL ישיר —
 * הערובה היא האינדקס, לא הקוד שמעליו.
 */
describe.skipIf(!hasDb)('לידים — אין כפילות לפי טלפון', () => {
  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('אותו מספר בפורמט אחר מחזיר את הליד הקיים ולא יוצר חדש', async () => {
    const first = await createProspect({ name: 'דורמקו', phone: '09-9500040', source: 'cold_call' });
    const again = await createProspect({ name: 'דורמקו בע"מ', phone: '+972 9-950-0040', source: 'google_places' });
    expect(first.created).toBe(true);
    expect(again).toEqual({ id: first.id, created: false });
    expect((await findProspectByPhone('099500040'))?.name).toBe('דורמקו');
  });

  it('לידים בלי טלפון לא מתנגשים זה בזה', async () => {
    const a = await createProspect({ name: 'בלי טלפון א' });
    const b = await createProspect({ name: 'בלי טלפון ב', phone: '' });
    expect(a.created && b.created).toBe(true);
  });

  it('שינוי טלפון למספר של ליד אחר נחסם, והמספר המקורי נשאר', async () => {
    const other = await createProspect({ name: 'ניומרקט', phone: '09-8655200' });
    expect(await updateProspectField(other.id, 'phone', '099500040')).toBe('duplicate_phone');
    const { rows } = await withPlatform((tx) =>
      tx.query<{ phone: string }>('select phone from platform_prospects where id = $1', [other.id]),
    );
    expect(rows[0]?.phone).toBe('09-8655200');
  });

  it('גם insert ישיר במסד נכשל — הערובה לא תלויה בקוד', async () => {
    await expect(
      withPlatform((tx) =>
        tx.query(`insert into platform_prospects (name, phone) values ('עוקף', '972-9-9500040')`),
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
