import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * חתימת URL קצרת-מועד לקבצים באחסון הלוקאלי — הדרך שבה `/api/files/*`
 * מממש "signed URL קצר-מועד" (כלל תמיד ב-CLAUDE.md) בלי S3/R2 אמיתי
 * מאחוריו עדיין. mime נכנס לחתימה כדי שאי אפשר יהיה לשנות אותו בכתובת
 * ולגרום לדפדפן להתייחס לקובץ כסוג אחר ממה שהוא.
 *
 * **אסור** לייצר כאן סוד אקראי כברירת מחדל: Next.js מהדר server
 * components ו-route handlers ליחידות נפרדות (על אחת כמה וכמה
 * בפריסה serverless, שבה כל route הוא הפעלה נפרדת) — כל אחת הייתה
 * מקבלת `randomBytes` משלה, כך שחתימה שנוצרה בצד אחד נכשלת אימות
 * בצד השני תמיד. בלי FILE_SIGNING_SECRET בסביבה: קבוע מפורש
 * ומתועד כלא-בטוח לפיתוח בלבד — יציב בין המהדורות, לא אקראי.
 */
const SECRET = process.env['FILE_SIGNING_SECRET'] ?? 'dev-only-insecure-file-signing-secret';

function sign(key: string, mime: string, exp: number): string {
  return createHmac('sha256', SECRET).update(`${key}:${mime}:${exp}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function signFileUrl(key: string, mime: string, ttlSeconds = 600): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const sig = sign(key, mime, exp);
  return `/api/files/${key}?exp=${exp}&mime=${encodeURIComponent(mime)}&sig=${sig}`;
}

export function verifyFileSignature(key: string, mime: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  return safeEqual(sig, sign(key, mime, expNum));
}
