import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  classifyDocument, extractBusinessIds, extractCounterparties, extractPdfText, hasExtractableText,
} from '@bossi/ai';
import {
  asPrincipal, createDocument, DOC_TYPES, findDocumentByHash, matchCustomers, publishEvent,
  type CustomerMatch,
} from '@bossi/db';
import { getStorageAdapter, newUploadKey } from '@bossi/integrations';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;

// אותו סף בדיוק כמו ה-UI הקיים (עמוד המסמך: "מתחת לסף — נדרש אישור"
// מתחת ל-0.8) ותיעוד הסיווג עצמו (packages/ai/classify.ts). מתחת לזה
// המסמך נשאר needs_review, בדיוק כמו מסמך שלא סווג בכלל.
const AUTO_FILE_THRESHOLD = 0.8;

/**
 * העלאת מסמך אחד או כמה. כל קובץ PDF עובר את הצינור המלא — חילוץ
 * טקסט, סיווג, חילוץ שדות, זיהוי צד נגדי, התאמת לקוח — ומעל הסף
 * משויך/מסווג אוטומטית. זו **הצעה**, לא נעילה: כל שיוך אוטומטי
 * נשאר ניתן לעריכה מיידית בעמוד המסמך (השדות הניתנים לעריכה מהספרינט
 * הקודם), ומסומן `manual: false` באירוע כדי שאפשר יהיה להבדיל בעתיד
 * בין מה שה-AI קבע לבין מה שאדם אישר/שינה. מתחת לסף — נשאר
 * needs_review כרגיל, בלי ניחוש.
 *
 * קובץ שאינו PDF, או PDF סרוק בלי שכבת טקסט (`hasExtractableText`),
 * עוקף את הצינור לגמרי — לא שגיאה, פשוט אין ממה לחלץ (OCR נדחה עד
 * כאב מדוד, CLAUDE.md).
 *
 * hash לפני כתיבה (CLAUDE.md "תמיד"): קובץ שכבר קיים אצל הדייר לא
 * נכתב שוב לאחסון ולא מסווג מחדש — יורש את הסיווג/השיוך מהעותק
 * הקודם שלו.
 */
export async function POST(request: NextRequest) {
  const principal = await currentPrincipal();
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await request.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  const customerIdRaw = form.get('customerId');
  const customerId = typeof customerIdRaw === 'string' && customerIdRaw ? customerIdRaw : null;

  if (files.length === 0) {
    return NextResponse.json({ error: 'no_files' }, { status: 400 });
  }
  if (files.some((f) => f.size > MAX_BYTES)) {
    return NextResponse.json({ error: 'file_too_large', maxBytes: MAX_BYTES }, { status: 413 });
  }

  const created: Array<{
    id: string;
    title: string;
    reused: boolean;
    docType: { value: string; label: string; confidence: number } | null;
    customerMatch: { customerId: string; displayName: string; confidence: number } | null;
  }> = [];

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash('sha256').update(bytes).digest('hex');

    const existing = await asPrincipal(principal, (tx) => findDocumentByHash(tx, contentHash));

    const storageKey = existing
      ? existing.storage_key
      : await (async () => {
          const key = newUploadKey(principal.tenantSlug, file.name);
          await getStorageAdapter().put(key, bytes);
          return `local:${key}`;
        })();

    let docType: string | null = null;
    let docTypeConfidence: number | null = null;
    let matchedCustomer: CustomerMatch | null = null;

    if (existing) {
      docType = existing.doc_type;
      docTypeConfidence = existing.doc_type_confidence;
    } else if (file.type === 'application/pdf') {
      try {
        const extracted = await extractPdfText(bytes);
        if (hasExtractableText(extracted)) {
          const classification = classifyDocument(extracted.text);
          if (classification.type && classification.confidence >= AUTO_FILE_THRESHOLD) {
            docType = classification.type;
            docTypeConfidence = classification.confidence;
          }

          if (!customerId) {
            const businessIds = extractBusinessIds(extracted.pages).map((f) => f.value);
            const names = extractCounterparties(extracted.pages).map((c) => c.name);
            if (businessIds.length > 0 || names.length > 0) {
              const matches = await asPrincipal(principal, (tx) => matchCustomers(tx, { businessIds, names }));
              if (matches[0] && matches[0].confidence >= AUTO_FILE_THRESHOLD) matchedCustomer = matches[0];
            }
          }
        }
      } catch {
        // PDF פגום/לא קריא — ממשיכים בלי סיווג, לא עוצרים את ההעלאה.
      }
    }

    const finalCustomerId = customerId ?? matchedCustomer?.customerId ?? (existing ? existing.customer_id : null);
    const title = titleFromFilename(file.name);

    const id = await asPrincipal(principal, async (tx) => {
      const docId = await createDocument(tx, {
        title,
        filename: file.name,
        storageKey,
        mime: file.type || 'application/octet-stream',
        byteSize: bytes.length,
        contentHash,
        source: 'upload',
        status: docType ? 'filed' : 'needs_review',
        customerId: finalCustomerId,
        docType,
        confidence: docTypeConfidence,
      });
      await publishEvent(tx, {
        type: 'documents.uploaded',
        actorType: 'user',
        actorId: principal.userId,
        customerId: finalCustomerId,
        subjectType: 'document',
        subjectId: docId,
        payload: { title, reused: Boolean(existing) },
      });
      if (!existing && docType) {
        await publishEvent(tx, {
          type: 'documents.classified',
          actorType: 'system',
          subjectType: 'document',
          subjectId: docId,
          payload: { docType, confidence: docTypeConfidence, manual: false },
        });
      }
      if (matchedCustomer) {
        await publishEvent(tx, {
          type: 'documents.filed',
          actorType: 'system',
          customerId: finalCustomerId,
          subjectType: 'document',
          subjectId: docId,
          payload: {
            customerId: finalCustomerId, confidence: matchedCustomer.confidence, matchedBy: matchedCustomer.matchedBy, manual: false,
          },
        });
      }
      return docId;
    });

    created.push({
      id,
      title,
      reused: Boolean(existing),
      docType: docType ? { value: docType, label: DOC_TYPES[docType as keyof typeof DOC_TYPES], confidence: docTypeConfidence! } : null,
      customerMatch: matchedCustomer
        ? { customerId: matchedCustomer.customerId, displayName: matchedCustomer.displayName, confidence: matchedCustomer.confidence }
        : null,
    });
  }

  return NextResponse.json({ documents: created });
}

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/[_-]+/g, ' ').trim() || filename;
}
