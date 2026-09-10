import { NextResponse, type NextRequest } from 'next/server';
import { asPrincipal, createDocumentShare, getDocument, listDocumentShares, publishEvent } from '@bossi/db';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** רשימת קישורי השיתוף שכבר נוצרו למסמך — כדי שאפשר יהיה לבטל ישנים. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const shares = await asPrincipal(principal, async (tx) => {
    const doc = await getDocument(tx, id);
    if (!doc) return null;
    return listDocumentShares(tx, id);
  });
  if (shares === null) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ shares });
}

/** יוצר קישור שיתוף חדש למסמך. תוקף בימים דרך גוף הבקשה, ברירת מחדל 7. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const ttlDays = Number.isFinite(body?.ttlDays) ? Math.min(Math.max(1, Number(body.ttlDays)), 30) : 7;

  const result = await asPrincipal(principal, async (tx) => {
    const doc = await getDocument(tx, id);
    if (!doc) return null;

    const share = await createDocumentShare(tx, {
      documentId: id, createdBy: principal.userId, ttlDays,
    });
    await publishEvent(tx, {
      type: 'documents.shared',
      actorType: 'user',
      actorId: principal.userId,
      subjectType: 'document',
      subjectId: id,
      payload: { ttlDays },
    });
    return share;
  });

  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const url = new URL(`/s/${result.token}`, request.url).toString();
  return NextResponse.json({ url, expiresAt: result.expiresAt });
}
