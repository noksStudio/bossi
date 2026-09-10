import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { asPrincipal, createDocument, findDocumentByHash, publishEvent } from '@bossi/db';
import { getStorageAdapter, newUploadKey } from '@bossi/integrations';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * העלאת מסמך אחד או כמה. כל קובץ הופך לשורת `documents` נפרדת עם
 * `status: needs_review` — הוא לא מסווג, ומישהו צריך לתייג אותו.
 *
 * hash לפני כתיבה (CLAUDE.md "תמיד"): קובץ שכבר קיים אצל הדייר לא
 * נכתב שוב לאחסון, השורה החדשה רק מצביעה על אותו `storage_key`.
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

  const created: Array<{ id: string; title: string; reused: boolean }> = [];

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
        status: 'needs_review',
        customerId,
      });
      await publishEvent(tx, {
        type: 'documents.uploaded',
        actorType: 'user',
        actorId: principal.userId,
        customerId,
        subjectType: 'document',
        subjectId: docId,
        payload: { title, reused: Boolean(existing) },
      });
      return docId;
    });

    created.push({ id, title, reused: Boolean(existing) });
  }

  return NextResponse.json({ documents: created });
}

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/[_-]+/g, ' ').trim() || filename;
}
