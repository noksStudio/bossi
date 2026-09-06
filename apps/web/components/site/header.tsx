import Link from 'next/link';
import { BossiWordmark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';

const LINKS = [
  { href: '#how', label: 'איך זה עובד' },
  { href: '#dashboard', label: 'דשבורד' },
  { href: '#search', label: 'חיפוש' },
  { href: '#modules', label: 'מודולים' },
  { href: '#pricing', label: 'מחירים' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Link href="/" className="text-primary">
          <BossiWordmark />
        </Link>

        <nav className="hidden flex-1 items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[0.9rem] text-secondary transition-colors hover:text-primary">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2.5 md:ms-0">
          <ThemeToggle />
          <a
            href="#pricing"
            className="rounded-md px-4 py-2 text-[0.9rem] font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}
          >
            להתחיל
          </a>
        </div>
      </div>
    </header>
  );
}
