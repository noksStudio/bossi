'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from '@/components/app/nav-icon';
import { ADMIN_NAV } from './admin-nav';

/**
 * סיידבר קונסולת הפלטפורמה. `'use client'` רק בשביל `usePathname` —
 * הדגשת היעד הפעיל, כדי שמי שמנהל שלושה דפים בו-זמנית לא יאבד את
 * עצמו. הרשימה עצמה קבועה (`ADMIN_NAV`), לא תלוית שרת.
 */
export function AdminSidenav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <nav className="flex-1 overflow-y-auto p-3">
      <ul className="space-y-0.5">
        {ADMIN_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.88rem] transition-colors"
                style={{
                  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: active ? 'var(--surface)' : 'var(--surface)',
                  opacity: active ? 1 : 0.72,
                }}
              >
                <NavIcon name={item.icon} className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
