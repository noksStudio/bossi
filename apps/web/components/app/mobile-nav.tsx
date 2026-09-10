'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import type { NavEntry } from '@bossi/kernel';
import { NavIcon } from '@/components/app/nav-icon';
import { splitMobileNav } from '@/lib/mobile-nav';

/**
 * תפריט תחתון בנייד — הדרך היחידה לנווט בטלפון, כי הסיידבר מוסתר
 * לגמרי מתחת ל-lg. חמישה יעדים בדיוק: עד ארבעה מהחשובים ביותר
 * (הראשונים ב-`nav`, שכבר ממוין לפי `order`) ותמיד "עוד" בסוף אם יש
 * יותר ממה שנכנס — שם נפתח גיליון עם כל השאר.
 */
export function MobileNav({ nav }: { nav: NavEntry[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { primary, overflow } = splitMobileNav(nav);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-surface lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="ניווט"
      >
        {primary.map((item) => (
          <Tile key={item.id} href={item.href} label={item.label} icon={item.icon} active={isActive(item.href)} />
        ))}
        {overflow.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] text-secondary"
          >
            <MoreHorizontal className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">עוד</span>
          </button>
        ) : null}
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full rounded-t-xl border-t border-hairline bg-raised pb-[env(safe-area-inset-bottom)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="עוד ניווט"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-hairline" />
            <ul className="grid grid-cols-4 gap-1 p-3">
              {overflow.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-col items-center gap-1 rounded-md px-2 py-3 text-[0.76rem] text-secondary transition-colors hover:bg-sunken"
                  >
                    <NavIcon name={item.icon} className="size-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tile({
  href, label, icon, active,
}: {
  href: string;
  label: string;
  icon?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] transition-colors ${
        active ? 'text-primary' : 'text-secondary'
      }`}
    >
      <NavIcon name={icon} className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
