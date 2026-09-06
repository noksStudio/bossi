import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { revokeSession } from '@bossi/db';
import { STAFF_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  // מנתקים גם במסד ולא רק בדפדפן — עוגייה שנמחקה מקומית אינה ניתוק.
  if (token) await revokeSession(token);
  jar.delete(STAFF_COOKIE);
  return NextResponse.redirect(new URL('/signin', request.url), { status: 303 });
}
