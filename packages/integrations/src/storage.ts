import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * שכבת אחסון קבצים — ממשק יחיד, מימוש מתחלף.
 *
 * S3/R2 הוא היעד המתוכנן (CLAUDE.md), אבל אין כאן עדיין אישורי חיבור
 * אמיתיים. במקום לחסום את כל הפיצ'ר על כך, יש כאן מימוש לוקאלי שמכבד
 * בדיוק את אותו חוזה — קובץ אמיתי נכתב ונקרא, לא מדומה — כך שביום
 * שיהיו אישורי R2 מחליפים רק את המימוש, לא את מי שקורא לו (ADR-004
 * עשה בדיוק את זה ל-Drizzle: תשתית נדחית עד כאב מדוד, לא עד שהיא
 * מוכנה מראש "ליתר ביטחון").
 */
export interface StorageAdapter {
  /** שומר בייטים תחת מפתח. */
  put(key: string, bytes: Buffer): Promise<void>;
  /** קורא בייטים בחזרה לפי מפתח. זורק אם המפתח לא קיים. */
  get(key: string): Promise<Buffer>;
}

const LOCAL_ROOT = process.env['LOCAL_STORAGE_DIR'] ?? '.data/uploads';

class LocalStorageAdapter implements StorageAdapter {
  async put(key: string, bytes: Buffer): Promise<void> {
    const path = join(LOCAL_ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(LOCAL_ROOT, key));
  }
}

let adapter: StorageAdapter | null = null;

/** בורר מימוש. היום תמיד לוקאלי — R2 נכנס כאן ביום שיהיו אישורים אמיתיים. */
export function getStorageAdapter(): StorageAdapter {
  if (!adapter) adapter = new LocalStorageAdapter();
  return adapter;
}

/** רק לבדיקות — מחליף את המימוש הפעיל. */
export function setStorageAdapterForTesting(a: StorageAdapter | null): void {
  adapter = a;
}

/** מפתח ייחודי לקובץ שהועלה. מזהה אקראי, לא שם הקובץ — שני קבצים בשם זהה לא מתנגשים. */
export function newUploadKey(tenantSlug: string, filename: string): string {
  return `${tenantSlug}/${randomUUID()}-${sanitizeFilename(filename)}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120);
}
