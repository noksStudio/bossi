import Link from 'next/link';
import { BossiMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { requirePrincipal } from '@/lib/session';
import { loadShell } from '@/lib/navigation';

export const dynamic = 'force-dynamic';

/**
 * שלד האזור המוגן.
 *
 * כאן קורה האימות האמיתי (middleware רק בדק שיש עוגייה), וכאן נבנה
 * הניווט מההרכבה של הדייר. מודול כבוי לא מופיע — לא כי מסתירים אותו,
 * אלא כי הוא לא נכנס לרשימה מלכתחילה.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePrincipal();
  const shell = await loadShell(principal);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-hairline bg-sunken lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-hairline px-4">
          <BossiMark size={22} />
          <span className="truncate text-[0.9rem] font-medium">{shell.tenantName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {shell.nav.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-[0.88rem] text-secondary transition-colors hover:bg-raised hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-hairline p-3">
          <div className="px-3 py-1.5">
            <div className="truncate text-[0.85rem] font-medium">{principal.name}</div>
            <div className="truncate text-[0.72rem] text-muted" dir="ltr">
              {principal.email}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="mt-1 w-full rounded-md px-3 py-1.5 text-start text-[0.82rem] text-muted transition-colors hover:bg-raised hover:text-primary"
            >
              יציאה
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BossiMark size={20} />
            <span className="truncate text-[0.88rem] font-medium">{shell.tenantName}</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden text-[0.78rem] text-muted sm:inline">
              {shell.modules.length} מודולים פעילים
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
