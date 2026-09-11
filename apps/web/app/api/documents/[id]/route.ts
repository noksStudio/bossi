import { NextResponse, type NextRequest } from 'next/server';
import {
  asPrincipal, DOC_TYPES, getDocument, publishEvent, setDocumentCustomer, setDocumentType,
} from '@bossi/db';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * עריכת שיוך לקוח / סוג מסמך — הצד השני בדיוק של "הצעה אוטומטית":
 * כל מה שה-AI מציע (ספרינט ד׳ הבא) עובר דרך הנתיב הזה בדיוק כדי
 * להשתנות. FK מורכב (documents_customer_fk) חוסם שיוך ללקוח של
 * דייר אחר — לא נבדק כאן שוב, המסד כבר אוכף.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const hasCustomerId = 'customerId' in body;
  const hasDocType = typeof body?.docType === 'string';

  if (!hasCustomerId && !hasDocType) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }
  if (hasDocType && !(body.docType in DOC_TYPES)) {
    return NextResponse.json({ error: 'unknown_doc_type' }, { status: 400 });
  }

  const ok = await asPrincipal(principal, async (tx) => {
    const doc = await getDocument(tx, id);
    if (!doc) return false;

    if (hasCustomerId) {
      const customerId = typeof body.customerId === 'string' ? body.customerId : null;
      await setDocumentCustomer(tx, id, customerId);
      await publishEvent(tx, {
        type: 'documents.filed',
        actorType: 'user',
        actorId: principal.userId,
        customerId,
        subjectType: 'document',
        subjectId: id,
        payload: { customerId },
      });
    }

    if (hasDocType) {
      await setDocumentType(tx, id, body.docType);
      await publishEvent(tx, {
        type: 'documents.classified',
        actorType: 'user',
        actorId: principal.userId,
        subjectType: 'document',
        subjectId: id,
        payload: { docType: body.docType, manual: true },
      });
    }

    return true;
  });

  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
