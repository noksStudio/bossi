import { redirect } from 'next/navigation';
import { requestLogin } from '@bossi/db';
import { BossiWordmark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { currentPrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'כניסה' };

/**
 * התחברות בקישור חד-פעמי. אין סיסמאות — אין מה לגנוב, אין מה למחזר,
 * ואין מסך "שכחתי סיסמה".
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; link?: string }>;
}) {
  if (await currentPrincipal()) redirect('/dashboard');
  const params = await searchParams;

  async function submit(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim();
    if (!email) redirect('/signin?error=1');

    const request = await requestLogin(email);

    // בפיתוח אין ספק מייל, ולכן הקישור מוחזר למסך.
    // בייצור זה לעולם לא קורה — אחרת כל אחד היה נכנס לכל חשבון.
    if (request && process.env.NODE_ENV !== 'production') {
      redirect(`/signin?sent=1&link=${encodeURIComponent(`/api/auth/verify?token=${request.token}`)}`);
    }

    // TODO(ספרינט 5): שליחת המייל דרך Resend.
    // אותה תשובה בדיוק גם כשאין משתמש — אחרת המסך מסגיר מי רשום.
    redirect('/signin?sent=1');
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <a href="/" className="text-primary">
          <BossiWordmark />
        </a>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="w-full max-w-sm">
          {params.sent ? (
            <>
              <h1 className="text-[1.7rem] leading-tight">בדוק את המייל</h1>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-secondary">
                אם הכתובת רשומה אצלנו, שלחנו אליה קישור כניסה. הוא תקף ל-20 דקות
                ומשמש פעם אחת.
              </p>

              {params.link ? (
                <div
                  className="mt-6 rounded-md border p-4"
                  style={{ borderColor: 'var(--warning)', background: 'var(--warning-quiet)' }}
                >
                  <p className="text-[0.8rem] font-medium" style={{ color: 'var(--warning)' }}>
                    סביבת פיתוח — אין ספק מייל מחובר
                  </p>
                  <a href={params.link} className="mt-2 block break-all text-[0.85rem] underline">
                    כניסה עם הקישור
                  </a>
                </div>
              ) : null}

              <a href="/signin" className="mt-6 inline-block text-[0.88rem] text-secondary underline">
                כתובת אחרת
              </a>
            </>
          ) : (
            <>
              <h1 className="text-[1.7rem] leading-tight">כניסה ל-Bossi</h1>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-secondary">
                הזן את כתובת המייל שלך ונשלח קישור כניסה. בלי סיסמאות.
              </p>

              <form action={submit} className="mt-7 space-y-3">
                <label htmlFor="email" className="block text-[0.85rem] font-medium">
                  כתובת מייל
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  dir="ltr"
                  placeholder="you@company.co.il"
                  className="w-full rounded-md border border-strong bg-raised px-3 py-2.5 text-[0.95rem] outline-none"
                />
                {params.error ? (
                  <p className="text-[0.85rem]" style={{ color: 'var(--danger)' }}>
                    צריך כתובת מייל תקינה.
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="w-full rounded-md py-2.5 text-[0.95rem] font-medium text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  שלח קישור כניסה
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
