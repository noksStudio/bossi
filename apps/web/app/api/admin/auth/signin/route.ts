import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { adminCredentials, signInPlatform } from '@bossi/db';
import { PLATFORM_COOKIE, clientIp, platformCookieOptions } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';

/**
 * התחברות אדמין. הנתיב היחיד במערכת שמקבל סיסמה.
 *
 * כשהקונסולה כבויה בסביבה — 404, לא 401. נתיב שמחזיר "לא מורשה" מאשר
 * שהוא קיים; 404 לא מאשר כלום.
 */
export async function POST(request: NextRequest) {
  if (!adminCredentials()) return new NextResponse('Not found', { status: 404 });

  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  const head = await headers();
  const result = await signInPlatform({
    email,
    password,
    ip: clientIp(head),
    userAgent: head.get('user-agent'),
  });

  if (!result.ok) {
    const reason = result.reason === 'locked' ? 'locked' : 'bad';
    return NextResponse.redirect(new URL(`/admin/signin?error=${reason}`, request.url), 303);
  }

  (await cookies()).set(PLATFORM_COOKIE, result.token, platformCookieOptions(result.expiresAt));
  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
