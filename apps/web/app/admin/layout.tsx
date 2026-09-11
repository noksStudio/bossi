import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminCredentials } from '@bossi/db';
import { BossiMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdminMobileNav } from '@/components/admin/admin-mobile-nav';
import { AdminSidenav } from '@/components/admin/admin-sidenav';
import { currentAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ניהול Bossi' };

/**
 * שלד קונסולת הפלטפורמה.
 *
 * נראה **אחרת בכוונה** מהאפליקציה של הדייר: סיידבר כהה במקום סרגל צד
 * בהיר. מי שמנהל שלושה עסקים בשלוש לשוניות צריך לדעת ממבט אחד באיזו
 * לשונית הוא מסתכל, במיוחד כשמסך אחד יכול לשנות חבילה של לקוח.
 *
 * הסיידבר והתפריט התחתון מוצגים רק למי שמחובר — מסך ההתחברות עצמו
 * מקבל את אותו שלד בלי ניווט, כי אין עדיין לאן לנווט.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // הקונסולה כבויה בסביבה → כל הענף לא קיים.
  if (!adminCredentials()) notFound();
  const admin = await currentAdmin();

  return (
    <div className="flex min-h-dvh">
      {admin ? (
        <aside
          className="hidden w-60 shrink-0 flex-col lg:flex"
          style={{ background: 'var(--surface-inverse)', color: 'var(--surface)' }}
        >
          <Link href="/admin" className="flex h-14 items-center gap-2.5 px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <BossiMark size={22} />
            <span className="truncate text-[0.9rem] font-medium">ניהול הפלטפורמה</span>
          </Link>

          <AdminSidenav />

          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="px-3 py-1.5 text-[0.72rem] opacity-70" dir="ltr">
              {admin.email}
            </div>
            <form action="/api/admin/auth/signout" method="post">
              <button
                type="submit"
                className="mt-1 w-full rounded-md px-3 py-1.5 text-start text-[0.82rem] opacity-75 transition-opacity hover:opacity-100"
              >
                יציאה
              </button>
            </form>
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BossiMark size={20} />
            <span className="truncate text-[0.88rem] font-medium">ניהול הפלטפורמה</span>
          </div>
          <div className="ms-auto flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-5 pb-24 lg:p-7">{children}</main>
      </div>

      {admin ? <AdminMobileNav /> : null}
    </div>
  );
}
