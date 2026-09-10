import { notFound, redirect } from 'next/navigation';
import { adminCredentials } from '@bossi/db';
import { currentAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'כניסת ניהול' };

const ERRORS: Record<string, string> = {
  bad: 'הפרטים אינם נכונים.',
  locked: 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.',
};

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!adminCredentials()) notFound();
  if (await currentAdmin()) redirect('/admin');

  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-[1.5rem]">כניסת ניהול</h1>
      <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
        אזור הפלטפורמה. אין כאן גישה לנתונים של לקוחות — רק לחבילות, למודולים ולמצב המערכת.
      </p>

      {error ? (
        <p
          className="mt-4 rounded-md px-3 py-2 text-[0.84rem]"
          style={{ background: 'var(--danger-quiet)', color: 'var(--danger)' }}
          role="alert"
        >
          {ERRORS[error] ?? ERRORS['bad']}
        </p>
      ) : null}

      <form action="/api/admin/auth/signin" method="post" className="mt-6 space-y-3">
        <div>
          <label htmlFor="email" className="block text-[0.8rem] text-secondary">
            כתובת מייל
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            dir="ltr"
            className="mt-1 w-full rounded-md border border-hairline bg-transparent px-3 py-2 text-[0.9rem]"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-[0.8rem] text-secondary">
            סיסמה
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            dir="ltr"
            className="mt-1 w-full rounded-md border border-hairline bg-transparent px-3 py-2 text-[0.9rem]"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md px-3 py-2 text-[0.88rem] font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
        >
          כניסה
        </button>
      </form>
    </div>
  );
}
