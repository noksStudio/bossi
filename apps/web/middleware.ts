import { NextResponse, type NextRequest } from 'next/server';

const STAFF_COOKIE = process.env['AUTH_STAFF_COOKIE'] ?? 'bossi_staff';
const PLATFORM_COOKIE = process.env['AUTH_PLATFORM_COOKIE'] ?? 'bossi_platform';

/**
 * שער ראשון בלבד: בודק שקיימת עוגייה, ולא מי היא.
 *
 * middleware רץ ב-edge ואין לו גישה למסד, ולכן הוא לא יכול לאמת חיבור.
 * האימות האמיתי קורה ב-layout של האזור המוגן, שרץ ב-node ומפענח את
 * העוגייה מול המסד. מי שמנסה לזייף עוגייה יעבור כאן וייחסם שם.
 *
 * **הרשימה היא של מה שפתוח, לא של מה שמוגן.** רשימת "מה מוגן" הייתה
 * צריכה להתעדכן בכל מסך חדש, ומסך שנשכח בה נשאר בלי השער הראשון —
 * בדיוק סוג התקלה שאף אחד לא מגלה עד שהיא כבר קרתה. בכיוון ההפוך
 * שכחה נכשלת סגור: מסך חדש מוגן כברירת מחדל.
 *
 * שני עולמות, שתי עוגיות: `/admin` נשען על עוגיית הפלטפורמה בלבד,
 * וכל השאר על עוגיית הצוות בלבד. עוגייה של עולם אחד אינה שווה דבר
 * בעולם השני, כאן ובשכבה שמתחת (כלל 2).
 */
const PUBLIC = ['/', '/signin', '/api/auth'];
const PLATFORM_PUBLIC = ['/admin/signin', '/api/admin/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
    if (PLATFORM_PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.next();
    }
    if (request.cookies.has(PLATFORM_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/signin', request.url));
  }

  if (PUBLIC.some((p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)))) {
    return NextResponse.next();
  }

  if (request.cookies.has(STAFF_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL('/signin', request.url));
}

export const config = {
  // כל מה שאינו נכס סטטי או תמונה. הסינון המדויק נעשה למעלה.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|woff2?)$).*)'],
};
