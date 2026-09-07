import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createDemoSession } from '@bossi/db';
import { STAFF_COOKIE, cookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** כניסת דמו. מסרבת בשקט לכל דייר שאינו ברשימה המותרת ואינו מסומן כדמו. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('t');
  if (!slug) return NextResponse.redirect(new URL('/signin', request.url));

  const session = await createDemoSession(slug);
  if (!session) return NextResponse.redirect(new URL('/signin?error=demo', request.url));

  (await cookies()).set(STAFF_COOKIE, session.token, cookieOptions(session.expiresAt));
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
