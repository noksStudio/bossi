'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from '@/components/app/nav-icon';
import { ADMIN_NAV } from './admin-nav';

/**
 * תפריט תחתון בנייד לקונסולת הפלטפורמה. ארבעה יעדים בלבד — נכנסים
 * בלי "עוד" (בהבדל מ-`MobileNav` של הדייר, שמודולים יכולים להציף).
 * כרטיס צף כדי להיראות כמו חלק מהאפליקציה, לא סרגל דפדפן.
 */
export function AdminMobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 flex gap-0.5 rounded-2xl border p-1.5 shadow-lg backdrop-blur-lg lg:hidden"
      style={{
        marginBottom: 'env(safe-area-inset-bottom)',
        background: 'color-mix(in srgb, var(--surface-inverse) 92%, transparent)',
        borderColor: 'rgba(255,255,255,0.12)',
      }}
      aria-label="ניווט ניהול"
    >
      {ADMIN_NAV.map((item) => {
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
  );
}
