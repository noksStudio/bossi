import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool,
  consumeLoginToken,
  createTenant,
  createUser,
  migrate,
  purgeExpired,
  requestLogin,
  resolveSession,
  revokeSession,
  withPlatform,
  withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDb)('אימות צוות', () => {
  let alpha: string;
  let beta: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});

    const stamp = Date.now().toString(36);
    alpha = await createTenant({ slug: `a-${stamp}`, name: 'דייר א', modules: ['documents'] });
    beta = await createTenant({ slug: `b-${stamp}`, name: 'דייר ב', modules: ['documents'] });

    await withTenant(alpha, (tx) => createUser(tx, { email: 'noa@alpha.co.il', name: 'נעה', role: 'owner' }));
    await withTenant(beta, (tx) => createUser(tx, { email: 'yossi@beta.co.il', name: 'יוסי', role: 'owner' }));
    // אותה כתובת בשני דיירים — מצב לא פתיר בכוונה
    await withTenant(alpha, (tx) => createUser(tx, { email: 'shared@x.co.il', name: 'א', role: 'staff' }));
    await withTenant(beta, (tx) => createUser(tx, { email: 'shared@x.co.il', name: 'ב', role: 'staff' }));
  }, 30_000);

  afterAll(async () => {
    await closePool();
  });

  it('מסלול מלא: בקשה → אסימון → חיבור → זהות', async () => {
    const req = await requestLogin('noa@alpha.co.il');
    expect(req).not.toBeNull();

    const session = await consumeLoginToken(req!.token);
    expect(session).not.toBeNull();

    const principal = await resolveSession(session!.token);
    expect(principal).toMatchObject({
      tenantId: alpha,
      email: 'noa@alpha.co.il',
      name: 'נעה',
      role: 'owner',
    });
  });

  it('אסימון התחברות הוא חד-פעמי', async () => {
    const req = await requestLogin('noa@alpha.co.il');
    expect(await consumeLoginToken(req!.token)).not.toBeNull();
    expect(await consumeLoginToken(req!.token)).toBeNull();
  });

  it('בקשה חדשה מבטלת את הקישור הקודם', async () => {
    const first = await requestLogin('noa@alpha.co.il');
    const second = await requestLogin('noa@alpha.co.il');
    expect(await consumeLoginToken(first!.token)).toBeNull();
    expect(await consumeLoginToken(second!.token)).not.toBeNull();
  });

  it('אסימון שפג אינו מתקבל', async () => {
    const req = await requestLogin('noa@alpha.co.il');
    await withPlatform((tx) =>
      tx.query("update login_tokens set expires_at = now() - interval '1 minute' where consumed_at is null"),
    );
    expect(await consumeLoginToken(req!.token)).toBeNull();
  });

  it('כתובת לא קיימת מחזירה בדיוק כמו כתובת קיימת — בלי להסגיר מי רשום', async () => {
    expect(await requestLogin('nobody@nowhere.co.il')).toBeNull();
  });

  it('כתובת שקיימת בשני דיירים נדחית במקום להיות מנוחשת', async () => {
    expect(await requestLogin('shared@x.co.il')).toBeNull();
  });

  it('משתמש מושהה לא מקבל אסימון', async () => {
    await withTenant(beta, (tx) =>
      tx.query("update users set status = 'suspended' where email = 'yossi@beta.co.il'"),
    );
    expect(await requestLogin('yossi@beta.co.il')).toBeNull();
    await withTenant(beta, (tx) =>
      tx.query("update users set status = 'active' where email = 'yossi@beta.co.il'"),
    );
  });

  it('חיבור שנפסל לא מזוהה יותר', async () => {
    const req = await requestLogin('noa@alpha.co.il');
    const session = await consumeLoginToken(req!.token);
    expect(await resolveSession(session!.token)).not.toBeNull();
    await revokeSession(session!.token);
    expect(await resolveSession(session!.token)).toBeNull();
  });

  it('אסימון מומצא אינו מזוהה', async () => {
    expect(await resolveSession('not-a-real-token')).toBeNull();
    expect(await resolveSession('')).toBeNull();
  });

  it('השעיית משתמש מנתקת חיבור קיים מיד', async () => {
    const req = await requestLogin('noa@alpha.co.il');
    const session = await consumeLoginToken(req!.token);
    await withTenant(alpha, (tx) =>
      tx.query("update users set status = 'suspended' where email = 'noa@alpha.co.il'"),
    );
    expect(await resolveSession(session!.token)).toBeNull();
    await withTenant(alpha, (tx) =>
      tx.query("update users set status = 'active' where email = 'noa@alpha.co.il'"),
    );
  });

  it('האסימון עצמו לא נשמר — במסד יש רק גיבוב', async () => {
    const req = await requestLogin('noa@alpha.co.il');
    const stored = await withPlatform(async (tx) => {
      const { rows } = await tx.query<{ token_hash: string }>(
        'select token_hash from login_tokens where consumed_at is null',
      );
      return rows.map((r) => r.token_hash);
    });
    expect(stored).not.toContain(req!.token);
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('דייר רואה רק את החיבורים של עצמו', async () => {
    const reqA = await requestLogin('noa@alpha.co.il');
    await consumeLoginToken(reqA!.token);
    const reqB = await requestLogin('yossi@beta.co.il');
    await consumeLoginToken(reqB!.token);

    const seenByAlpha = await withTenant(alpha, (tx) =>
      tx.query<{ tenant_id: string }>('select tenant_id from sessions'),
    );
    expect(seenByAlpha.rows.every((r) => r.tenant_id === alpha)).toBe(true);
    expect(seenByAlpha.rows.length).toBeGreaterThan(0);
  });

  it('הצוות לא יכול ליצור חיבורים ביד — רק לנתק', async () => {
    await expect(
      withTenant(alpha, (tx) =>
        tx.query(
          "insert into sessions (tenant_id, user_id, token_hash, expires_at) values (current_tenant(), gen_random_uuid(), 'x', now() + interval '1 day')",
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('ניקוי מסיר אסימונים וחיבורים שפגו', async () => {
    await withPlatform((tx) =>
      tx.query("update sessions set expires_at = now() - interval '1 day'"),
    );
    await purgeExpired();
    const left = await withPlatform((tx) => tx.query('select 1 from sessions'));
    expect(left.rowCount).toBe(0);
  });
});
