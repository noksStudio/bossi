import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession, type Principal } from '@bossi/db';

export const STAFF_COOKIE = process.env['AUTH_STAFF_COOKIE'] ?? 'bossi_staff';

/**
 * עוגיית הצוות. `httpOnly` כדי ש-JS בדף לא יוכל לקרוא אותה,
 * ו-`sameSite: lax` כדי שקישור מהמייל יעבוד אבל POST חוצה-אתרים לא.
 */
export function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export async function currentPrincipal(): Promise<Principal | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token);
}

/** לשימוש בכל מסך מוגן. מפנה להתחברות כשאין זהות תקפה. */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await currentPrincipal();
  if (!principal) redirect('/signin');
  return principal;
}
