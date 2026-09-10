import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminCredentials } from '@bossi/db';
import { BossiMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { currentAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ניהול Bossi' };

/**
 * שלד קונסולת הפלטפורמה.
 *
 * נראה **אחרת בכוונה** מהאפליקציה של הדייר: פס עליון כהה במקום סרגל
 * צד בהיר. מי שמנהל שלושה עסקים בשלוש לשוניות צריך לדעת ממבט אחד
 * באיזו לשונית הוא מסתכל, במיוחד כשמסך אחד יכול לשנות חבילה של לקוח.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // הקונסולה כבויה בסביבה → כל הענף לא קיים.
  if (!adminCredentials()) notFound();
  const admin = await currentAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="flex h-14 shrink-0 items-center gap-4 px-5"
        style={{ background: 'var(--surface-inverse)', color: 'var(--surface)' }}
      >
        <Link href="/admin" className="flex items-center gap-2.5">
          <BossiMark size={20} />
          <span className="text-[0.9rem] font-medium">ניהול הפלטפורמה</span>
        </Link>

        {admin ? (
          <nav className="flex items-center gap-1 text-[0.84rem]">
            <AdminLink href="/admin">דיירים</AdminLink>
            <AdminLink href="/admin/packages">חבילות</AdminLink>
            <AdminLink href="/admin/system">מערכת</AdminLink>
          </nav>
        ) : null}

        <div className="ms-auto flex items-center gap-3">
          <ThemeToggle />
          {admin ? (
            <>
              <span className="hidden text-[0.76rem] opacity-70 sm:inline" dir="ltr">
                {admin.email}
              </span>
              <form action="/api/admin/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-sm px-2.5 py-1 text-[0.8rem] opacity-80 transition-opacity hover:opacity-100"
                  style={{ border: '1px solid currentColor' }}
                >
                  יציאה
                </button>
              </form>
            </>
          ) : null}
        </div>
      </header>

      <main className="min-w-0 flex-1 p-5 lg:p-7">{children}</main>
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-sm px-2.5 py-1.5 opacity-75 transition-opacity hover:opacity-100">
      {children}
    </Link>
  );
}
