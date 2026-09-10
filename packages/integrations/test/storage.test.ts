import { rm } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * מימוש לוקאלי של StorageAdapter — לא מדומה, קובץ אמיתי נכתב ונקרא.
 * `LOCAL_STORAGE_DIR` נקבע לפני הייבוא כי המודול קורא אותו פעם אחת
 * בטעינה (`.data/uploads` כברירת מחדל).
 */

const TMP_DIR = `.tmp-storage-test-${Date.now().toString(36)}`;
process.env['LOCAL_STORAGE_DIR'] = TMP_DIR;

const { getStorageAdapter, newUploadKey } = await import('../src/storage');

describe('LocalStorageAdapter', () => {
  beforeAll(() => {});
  afterAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('כותבת בייטים וקוראת אותם בחזרה זהים', async () => {
    const adapter = getStorageAdapter();
    const bytes = Buffer.from('שלום, זה קובץ בדיקה', 'utf-8');

    await adapter.put('a/b/file.txt', bytes);
    const back = await adapter.get('a/b/file.txt');

    expect(back.equals(bytes)).toBe(true);
  });

  it('קריאת מפתח שלא נכתב זורקת', async () => {
    const adapter = getStorageAdapter();
    await expect(adapter.get('no/such/key')).rejects.toThrow();
  });

  it('newUploadKey מייצר מפתחות שונים לאותו שם קובץ', () => {
    const a = newUploadKey('demo-lavi', 'חוזה.pdf');
    const b = newUploadKey('demo-lavi', 'חוזה.pdf');
    expect(a).not.toBe(b);
    expect(a.startsWith('demo-lavi/')).toBe(true);
  });

  it('newUploadKey מנטרל מפרידי נתיב משם הקובץ — אין דרך לברוח מהתיקייה', () => {
    // חתך התיקייה של אחסון-לוקאלי הוא `/`-מופרד; שם קובץ שמכיל `/`
    // (למשל `../../etc/passwd`) יכול היה להימלט מתיקיית הדייר אם
    // לא היה מנוטרל. הנקודות עצמן לא מסוכנות בלי מפריד לצדן.
    const key = newUploadKey('t', '../../etc/passwd');
    const filenamePart = key.split('/').slice(1).join('/'); // אחרי ה-tenant slug
    expect(filenamePart).not.toContain('/');
  });
});
