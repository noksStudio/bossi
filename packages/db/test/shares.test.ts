import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createDocument, createDocumentShare, createTenant, createUser,
  listDocumentShares, migrate, resolveShareToken, revokeDocumentShare, withPlatform, withTenant,
} from '../src/index';

/**
 * קישורי שיתוף — הבדיקה המרכזית היא ש-`share_resolve_token` (0014)
 * מתנהגת בדיוק כמו `auth_resolve_session`: מזהה מתוך אסימון בלבד,
 * דוחה פג/מבוטל/מומצא באותה תשובה (null), ולא חוצה דיירים.
 */

const hasDb = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDb)('קישורי שיתוף למסמכים', () => {
  let alpha: string;
  let beta: string;
  let alphaUser: string;
  let alphaDoc: string;
  let betaDoc: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
    const stamp = Date.now().toString(36);
    alpha = await createTenant({ slug: `a-${stamp}`, name: 'דייר א', modules: ['documents'] });
    beta = await createTenant({ slug: `b-${stamp}`, name: 'דייר ב', modules: ['documents'] });

    await withTenant(alpha, async (tx) => {
      alphaUser = await createUser(tx, { email: 'a@a.test', name: 'עובד א', role: 'owner' });
      alphaDoc = await createDocument(tx, {
        title: 'חוזה שירותים', filename: 'c.pdf', storageKey: 'demo:contract.pdf',
      });
    });
    await withTenant(beta, async (tx) => {
      betaDoc = await createDocument(tx, {
        title: 'חוזה של דייר אחר', filename: 'x.pdf', storageKey: 'demo:contract.pdf',
      });
    });
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('קישור תקין נפתר לפרטי המסמך הנכונים', async () => {
    const { token } = await withTenant(alpha, (tx) =>
      createDocumentShare(tx, { documentId: alphaDoc, createdBy: alphaUser }),
    );

    const resolved = await resolveShareToken(token);
    expect(resolved?.documentId).toBe(alphaDoc);
    expect(resolved?.tenantId).toBe(alpha);
    expect(resolved?.title).toBe('חוזה שירותים');
  });

  it('אסימון מומצא, ריק, או שאף פעם לא היה קיים — כולם null, אותה תשובה', async () => {
    expect(await resolveShareToken('made-up-token')).toBeNull();
    expect(await resolveShareToken('')).toBeNull();
  });

  it('קישור מבוטל לא נפתר יותר', async () => {
    const { token } = await withTenant(alpha, (tx) =>
      createDocumentShare(tx, { documentId: alphaDoc, createdBy: alphaUser }),
    );
    expect(await resolveShareToken(token)).not.toBeNull();

    const shares = await withTenant(alpha, (tx) => listDocumentShares(tx, alphaDoc));
    const ok = await withTenant(alpha, (tx) => revokeDocumentShare(tx, shares[0]!.id));
    expect(ok).toBe(true);

    expect(await resolveShareToken(token)).toBeNull();
  });

  it('ביטול שכבר בוטל מחזיר false — לא זורק', async () => {
    const { token } = await withTenant(alpha, (tx) =>
      createDocumentShare(tx, { documentId: alphaDoc, createdBy: alphaUser }),
    );
    const shares = await withTenant(alpha, (tx) => listDocumentShares(tx, alphaDoc));
    const shareId = shares.find((s) => s.revoked_at === null)!.id;
    void token;

    expect(await withTenant(alpha, (tx) => revokeDocumentShare(tx, shareId))).toBe(true);
    expect(await withTenant(alpha, (tx) => revokeDocumentShare(tx, shareId))).toBe(false);
  });

  it('קישור שפג את תוקפו לא נפתר', async () => {
    const { token } = await withTenant(alpha, (tx) =>
      createDocumentShare(tx, { documentId: alphaDoc, createdBy: alphaUser, ttlDays: 1 }),
    );
    await withPlatform((tx) =>
      tx.query("update document_shares set expires_at = now() - interval '1 minute' where document_id = $1", [alphaDoc]),
    );
    expect(await resolveShareToken(token)).toBeNull();
  });

  it('צפייה מעדכנת מונה ותאריך צפייה אחרונה', async () => {
    const { token } = await withTenant(alpha, (tx) =>
      createDocumentShare(tx, { documentId: alphaDoc, createdBy: alphaUser }),
    );
    await resolveShareToken(token);
    await resolveShareToken(token);

    const shares = await withTenant(alpha, (tx) => listDocumentShares(tx, alphaDoc));
    const created = shares.find((s) => s.view_count > 0);
    expect(created?.view_count).toBe(2);
    expect(created?.last_viewed_at).not.toBeNull();
  });

  it('רשימת השיתופים של דייר ב׳ לא חושפת דבר מדייר א׳', async () => {
    await withTenant(alpha, (tx) => createDocumentShare(tx, { documentId: alphaDoc, createdBy: alphaUser }));

    const betaShares = await withTenant(beta, (tx) => listDocumentShares(tx, alphaDoc));
    expect(betaShares).toEqual([]); // גם אם (בטעות) מבקשים לפי מזהה המסמך של א׳
  });

  it('לא ניתן ליצור שיתוף למסמך של דייר אחר — ה-FK המורכב חוסם', async () => {
    await expect(
      withTenant(alpha, (tx) => createDocumentShare(tx, { documentId: betaDoc, createdBy: alphaUser })),
    ).rejects.toThrow();
  });
});
