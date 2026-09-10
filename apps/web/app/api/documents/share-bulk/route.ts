import { NextResponse, type NextRequest } from 'next/server';
import { asPrincipal, createDocumentShare, getDocument, publishEvent } from '@bossi/db';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MAX_DOCS = 15;

/**
 * קישור שיתוף לכמה מסמכים בבת אחת — כל מסמך מקבל את השורה הרגילה
 * שלו ב-document_shares (אין "חבילה" חדשה בסכמה), וההודעה שנשלחת
 * מרכזת את כולם לטקסט אחד. מסמך שלא נמצא (מזהה שגוי, או שייך לדייר
 * אחר — RLS דואג לזה) פשוט לא מופיע בתשובה, בלי לשבור את השאר.
 */
export async function POST(request: NextRequest) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const documentIds: string[] = Array.isArray(body?.documentIds)
    ? body.documentIds.filter((id: unknown) => typeof id === 'string').slice(0, MAX_DOCS)
    : [];
  if (documentIds.length === 0) {
    return NextResponse.json({ error: 'no_documents' }, { status: 400 });
  }

  const shares: Array<{ id: string; title: string; url: string }> = [];

  for (const documentId of documentIds) {
    const result = await asPrincipal(principal, async (tx) => {
      const doc = await getDocument(tx, documentId);
      if (!doc) return null;

      const share = await createDocumentShare(tx, { documentId, createdBy: principal.userId });
      await publishEvent(tx, {
        type: 'documents.shared',
        actorType: 'user',
        actorId: principal.userId,
        subjectType: 'document',
        subjectId: documentId,
        payload: { ttlDays: 7, bulk: true },
      });
      return { title: doc.title, token: share.token };
    });

    if (result) {
      shares.push({
        id: documentId,
        title: result.title,
        url: new URL(`/s/${result.token}`, request.url).toString(),
      });
    }
  }

  if (shares.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ shares });
}
