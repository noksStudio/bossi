import { NextResponse, type NextRequest } from 'next/server';
import { getStorageAdapter } from '@bossi/integrations';
import { verifyFileSignature } from '@/lib/file-signing';

export const dynamic = 'force-dynamic';

/**
 * מגיש קובץ מהאחסון הלוקאלי — נתיב ציבורי לגמרי (ראו middleware),
 * כי הבטיחות כאן היא החתימה עצמה ולא עוגיית התחברות. זו בדיוק
 * ההתנהגות של signed URL אמיתי מול R2/S3: מי שמחזיק את הכתובת
 * המלאה, החתומה והלא-פגה, רשאי לקרוא — בלי קשר למי הוא.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  const key = segments.join('/');

  const exp = request.nextUrl.searchParams.get('exp') ?? '';
  const mime = request.nextUrl.searchParams.get('mime') ?? 'application/octet-stream';
  const sig = request.nextUrl.searchParams.get('sig') ?? '';

  if (!verifyFileSignature(key, mime, exp, sig)) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 403 });
  }

  try {
    const bytes = await getStorageAdapter().get(key);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=0, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
