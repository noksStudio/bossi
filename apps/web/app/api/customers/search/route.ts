import { NextResponse, type NextRequest } from 'next/server';
import { asPrincipal, quickSearchCustomers } from '@bossi/db';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** מזין את לוח הפקודות. הזהות מגיעה מהעוגייה, לא מפרמטר. */
export async function GET(request: NextRequest) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ results: [] }, { status: 401 });

  const q = request.nextUrl.searchParams.get('q') ?? '';
  const results = await asPrincipal(principal, (tx) => quickSearchCustomers(tx, q));
  return NextResponse.json({ results });
}
