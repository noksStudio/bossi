import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { consumeLoginToken } from '@bossi/db';
import { STAFF_COOKIE, cookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** ממיר קישור מהמייל לחיבור פעיל. האסימון נשרף בשימוש. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/signin?error=1', request.url));

  const session = await consumeLoginToken(token, request.headers.get('user-agent') ?? undefined);
  if (!session) return NextResponse.redirect(new URL('/signin?error=expired', request.url));

  (await cookies()).set(STAFF_COOKIE, session.token, cookieOptions(session.expiresAt));
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
