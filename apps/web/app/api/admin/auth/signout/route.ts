import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { recordAudit, signOutPlatform } from '@bossi/db';
import { PLATFORM_COOKIE } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const token = jar.get(PLATFORM_COOKIE)?.value;

  if (token) {
    await signOutPlatform(token);
    await recordAudit({ kind: 'logout' });
  }
  jar.delete(PLATFORM_COOKIE);

  return NextResponse.redirect(new URL('/admin/signin', request.url), 303);
}
