import { FileX2 } from 'lucide-react';
import { resolveShareToken } from '@bossi/db';
import { BossiMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { documentUrl, formatBytes, formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await resolveShareToken(token);
  return { title: share?.title ?? 'קישור שיתוף' };
}

/**
 * הצד השני של קישור השיתוף — בלי חשבון, בלי סיידבר, בלי שום דבר
 * שקושר את הצופה לזהות. אם `resolveShareToken` מחזיר null (פג, בוטל,
 * או אף פעם לא היה קיים) התשובה זהה בכל שלושת המקרים — כמו בכל נתיב
 * אנונימי אחר במערכת (השוו `requestLogin`): לא מסגירים מה בדיוק קרה.
 */
export default async function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await resolveShareToken(token);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-5">
        <BossiMark size={20} />
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-5 lg:p-8">
        {share ? <SharedDocument share={share} /> : <InvalidLink />}
      </main>
    </div>
  );
}

function SharedDocument({ share }: { share: NonNullable<Awaited<ReturnType<typeof resolveShareToken>>> }) {
  const url = documentUrl(share.storageKey);
  const embedUrl = url ? `${url}#toolbar=0&navpanes=0&view=Fit` : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.3rem]">{share.title}</h1>
        <p className="mt-1 text-[0.82rem] text-muted">
          {formatBytes(share.byteSize)} · קישור זה בתוקף עד {formatDate(share.expiresAt)}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline bg-sunken">
        {url ? (
          <object data={embedUrl!} type="application/pdf" className="h-[70vh] w-full">
            <div className="p-8 text-center text-[0.9rem] text-secondary">
              הדפדפן לא מציג PDF מוטמע.{' '}
              <a href={url} className="underline" target="_blank" rel="noreferrer">פתח את הקובץ</a>
            </div>
          </object>
        ) : (
          <div className="p-10 text-center text-[0.9rem] text-secondary">התצוגה עדיין לא זמינה לקובץ הזה.</div>
        )}
      </div>

      {url ? (
        <a
          href={url}
          download={share.filename}
          className="inline-block rounded-md px-4 py-2 text-[0.88rem] font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          הורדה
        </a>
      ) : null}
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="m-auto max-w-sm text-center">
      <FileX2 className="mx-auto size-9 text-muted" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="mt-3 text-[1.1rem]">הקישור אינו תקין</h1>
      <p className="mt-2 text-[0.88rem] leading-relaxed text-secondary">
        הקישור הזה כבר לא פעיל — פג תוקפו, בוטל, או שהכתובת לא מדויקת.
        אפשר לבקש קישור חדש ממי ששלח אותו.
      </p>
    </div>
  );
}
