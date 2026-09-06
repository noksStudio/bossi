import { NextResponse, type NextRequest } from 'next/server';

const STAFF_COOKIE = process.env['AUTH_STAFF_COOKIE'] ?? 'bossi_staff';
const PROTECTED = ['/dashboard', '/customers', '/documents', '/search', '/settings'];

/**
 * שער ראשון בלבד: בודק שקיימת עוגייה, ולא מי היא.
 *
 * middleware רץ ב-edge ואין לו גישה למסד, ולכן הוא לא יכול לאמת חיבור.
 * האימות האמיתי קורה ב-layout של האזור המוגן, שרץ ב-node ומפענח את
 * העוגייה מול המסד. מי שמנסה לזייף עוגייה יעבור כאן וייחסם שם.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (request.cookies.has(STAFF_COOKIE)) return NextResponse.next();

  const url = new URL('/signin', request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*', '/customers/:path*', '/documents/:path*', '/search/:path*', '/settings/:path*'],
};
