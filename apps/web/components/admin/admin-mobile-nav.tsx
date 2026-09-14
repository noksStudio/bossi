'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { NavIcon } from '@/components/app/nav-icon';
import { ADMIN_NAV } from './admin-nav';

/**
 * תפריט תחתון בנייד לקונסולת הפלטפורמה.
 *
 * הכפתור הימני ביותר (`דיירים` ברשימה — RTL הופך את סדר ה-DOM
 * לימין-שמאל) הוא לא קישור ישיר אלא כפתור "תפריט": בדסקטופ הסיידבר
 * נושא גם את זהות האדמין וגם את היציאה, ואלה לא היו נגישים בנייד
 * בכלל בלי הכפתור הזה. הגיליון שנפתח כולל את כל היעדים (כולל דיירים
 * עצמו) כדי שלא לאבד ניווט ישיר.
 */
export function AdminMobileNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));
  const [menuItem, ...restItems] = ADMIN_NAV;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex gap-0.5 rounded-2xl border p-1.5 shadow-lg backdrop-blur-lg lg:hidden"
        style={{
          marginBottom: 'env(safe-area-inset-bottom)',
          background: 'color-mix(in srgb, var(--surface-inverse) 92%, transparent)',
          borderColor: 'rgba(255,255,255,0.12)',
        }}
        aria-label="ניווט ניהול"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[0.66rem] transition-colors"
          style={{ color: 'var(--surface)', opacity: 0.68 }}
        >
          <span className="flex items-center justify-center rounded-full px-3.5 py-1">
            <Menu className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span>תפריט</span>
        </button>

        {restItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[0.66rem] transition-colors"
              style={{ color: 'var(--surface)' }}
            >
              <span
                className="flex items-center justify-center rounded-full px-3.5 py-1 transition-colors"
                style={{ background: active ? 'rgba(255,255,255,0.16)' : 'transparent', opacity: active ? 1 : 0.68 }}
              >
                <NavIcon name={item.icon} className="size-5 shrink-0" />
              </span>
              <span style={{ opacity: active ? 1 : 0.68, fontWeight: active ? 500 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        role="presentation"
      >
        <div
          className={`fixed inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-200 ease-out ${
            open ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ background: 'var(--surface-inverse)', color: 'var(--surface)' }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="תפריט ניהול"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />

          <nav className="p-3">
            <ul className="space-y-0.5">
              {[menuItem, ...restItems].map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[0.9rem] transition-colors"
                      style={{ background: active ? 'rgba(255,255,255,0.1)' : 'transparent', opacity: active ? 1 : 0.85 }}
                    >
                      <NavIcon name={item.icon} className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="px-3 py-1.5 text-[0.72rem] opacity-70" dir="ltr">{adminEmail}</div>
            <form action="/api/admin/auth/signout" method="post">
              <button
                type="submit"
                className="mt-1 w-full rounded-md px-3 py-2 text-start text-[0.85rem] opacity-75 transition-opacity hover:opacity-100"
              >
                יציאה
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
