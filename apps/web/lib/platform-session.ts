import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { adminCredentials, resolvePlatformSession, type PlatformAdmin } from '@bossi/db';

/**
 * עוגיית אדמין הפלטפורמה — **נפרדת מעוגיית הצוות בשם ובמשמעות**.
 *
 * שתי עוגיות ולא תפקיד אחת: עוגיית צוות תקפה לא פותחת את `/admin`,
 * ועוגיית אדמין לא פותחת שום מסך של דייר. אין ביניהן שום נתיב המרה
 * (CLAUDE.md כלל 2).
 */
export const PLATFORM_COOKIE = process.env['AUTH_PLATFORM_COOKIE'] ?? 'bossi_platform';

export function platformCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    // נשלחת רק לנתיבי הניהול. בקשה רגילה של האפליקציה לא נושאת אותה בכלל.
    path: '/',
    expires: expiresAt,
  };
}

export async function currentAdmin(): Promise<PlatformAdmin | null> {
  if (!adminCredentials()) return null;
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  return resolvePlatformSession(token);
}

/**
 * לשימוש בכל מסך ניהול.
 *
 * כשהקונסולה כבויה בסביבה — **404 ולא הפניה להתחברות**. מסך התחברות
 * שמופיע מסגיר שיש כאן דלת; 404 לא מסגיר כלום.
 */
export async function requireAdmin(): Promise<PlatformAdmin> {
  if (!adminCredentials()) notFound();
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/signin');
  return admin;
}

/** ה-IP של הבקשה, לתיעוד ולהגבלת קצב. Vercel מעביר אותו בכותרת. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip');
}
