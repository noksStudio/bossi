import Link from 'next/link';
import { moduleName } from '@/lib/navigation';
import type { CustomerTab } from '@/lib/customer-tabs';

export function CustomerTabs({
  tabs,
  customerId,
  active,
}: {
  tabs: CustomerTab[];
  customerId: string;
  active: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline">
      <Tab href={`/customers/${customerId}`} label="סקירה" active={active === 'overview'} />
      {tabs.map((tab) =>
        tab.href ? (
          <Tab key={tab.id} href={tab.href} label={tab.label} active={active === tab.id} />
        ) : (
          <span
            key={tab.id}
            className="cursor-default px-3 pb-2 text-[0.88rem] text-muted opacity-60"
            title={`${moduleName(tab.moduleId)} — נבנה בספרינט הקרוב`}
          >
            {tab.label}
          </span>
        ),
      )}
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="border-b-2 px-3 pb-2 text-[0.88rem] transition-colors"
      style={
        active
          ? { borderColor: 'var(--accent)', fontWeight: 500 }
          : { borderColor: 'transparent', color: 'var(--text-secondary)' }
      }
    >
      {label}
    </Link>
  );
}
