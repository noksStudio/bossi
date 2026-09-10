import { NextResponse, type NextRequest } from 'next/server';
import { asPrincipal, revokeDocumentShare } from '@bossi/db';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** מבטל קישור שיתוף. הביטול מיידי — הצפייה הבאה בקישור נכשלת. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { shareId } = await params;

  const ok = await asPrincipal(principal, (tx) => revokeDocumentShare(tx, shareId));
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
