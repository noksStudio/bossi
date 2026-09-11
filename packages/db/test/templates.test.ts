import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePool, createTemplate, createTenant, deleteTemplate, fillTemplate, getTemplate, listTemplates,
  migrate, updateTemplate, withPlatform, withTenant,
} from '../src/index';

const hasDb = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDb)('תבניות הודעה', () => {
  let alpha: string;
  let beta: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
    const stamp = Date.now().toString(36);
    alpha = await createTenant({ slug: `a-${stamp}`, name: 'דייר א', modules: [] });
    beta = await createTenant({ slug: `b-${stamp}`, name: 'דייר ב', modules: [] });
  }, 30_000);

  afterAll(async () => { await closePool(); });

  it('יצירה וקריאה', async () => {
    const id = await withTenant(alpha, (tx) =>
      createTemplate(tx, { name: 'פנייה קרה — ראשונית', channel: 'whatsapp', body: 'היי {{contact_name}}, מדבר מ-Bossi' }),
    );
    const t = await withTenant(alpha, (tx) => getTemplate(tx, id));
    expect(t?.name).toBe('פנייה קרה — ראשונית');
    expect(t?.channel).toBe('whatsapp');
    expect(t?.updated_at).toBeNull();
  });

  it('סינון רשימה לפי ערוץ', async () => {
    await withTenant(alpha, (tx) => createTemplate(tx, { name: 'תסריט טלפון', channel: 'phone', body: 'שלום, מדבר מ...' }));
    const phoneOnly = await withTenant(alpha, (tx) => listTemplates(tx, 'phone'));
    expect(phoneOnly.every((t) => t.channel === 'phone')).toBe(true);
    expect(phoneOnly.length).toBeGreaterThan(0);
  });

  it('עדכון משנה תוכן ומסמן updated_at', async () => {
    const id = await withTenant(alpha, (tx) => createTemplate(tx, { name: 'טיוטה', channel: 'email', body: 'טקסט ראשוני' }));
    await withTenant(alpha, (tx) => updateTemplate(tx, id, { name: 'טיוטה', channel: 'email', body: 'טקסט מעודכן' }));
    const t = await withTenant(alpha, (tx) => getTemplate(tx, id));
    expect(t?.body).toBe('טקסט מעודכן');
    expect(t?.updated_at).not.toBeNull();
  });

  it('מחיקה, ולא נוגעת בתבנית של דייר אחר', async () => {
    const id = await withTenant(alpha, (tx) => createTemplate(tx, { name: 'למחיקה', channel: 'other', body: 'טקסט' }));
    expect(await withTenant(beta, (tx) => deleteTemplate(tx, id))).toBe(false);
    expect(await withTenant(alpha, (tx) => getTemplate(tx, id))).not.toBeNull();
    expect(await withTenant(alpha, (tx) => deleteTemplate(tx, id))).toBe(true);
  });

  it('תבנית של דייר אחר אינה נגישה גם עם המזהה המדויק', async () => {
    const id = await withTenant(beta, (tx) => createTemplate(tx, { name: 'של ב', channel: 'whatsapp', body: 'טקסט' }));
    expect(await withTenant(alpha, (tx) => getTemplate(tx, id))).toBeNull();
  });

  it('גוף ריק (רק רווחים) נדחה במסד', async () => {
    await expect(
      withTenant(alpha, (tx) => createTemplate(tx, { name: 'ריק', channel: 'whatsapp', body: '   ' })),
    ).rejects.toThrow();
  });
});

describe('fillTemplate', () => {
  it('ממלאת שני ה-placeholders', () => {
    const filled = fillTemplate('היי {{contact_name}} מ{{business_name}}, ...', {
      contactName: 'דני', businessName: 'עיצוב בע״מ',
    });
    expect(filled).toBe('היי דני מעיצוב בע״מ, ...');
  });

  it('ערך חסר הופך למחרוזת ריקה, לא נשאר {{...}} בטקסט', () => {
    const filled = fillTemplate('היי {{contact_name}}!', { contactName: null });
    expect(filled).toBe('היי !');
    expect(filled).not.toContain('{{');
  });

  it('placeholder שמופיע כמה פעמים מתמלא בכולן', () => {
    const filled = fillTemplate('{{contact_name}}, שוב {{contact_name}}', { contactName: 'X' });
    expect(filled).toBe('X, שוב X');
  });

  it('טקסט בלי placeholders בכלל חוזר כמות שהוא', () => {
    expect(fillTemplate('טקסט רגיל', {})).toBe('טקסט רגיל');
  });
});
