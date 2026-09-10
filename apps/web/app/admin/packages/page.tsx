import Link from 'next/link';
import { listFeaturePackages } from '@bossi/db';
import { requireAdmin } from '@/lib/platform-session';
import { StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'חבילות · ניהול' };

/**
 * רשימת החבילות — תבניות למעלה, חד-פעמיות למטה (אותו סדר שמחזירה
 * `listFeaturePackages`). "חד-פעמית" היא חבילה עם `is_template=false`:
 * עדיין קיימת לעריכה, רק לא מוצעת כברירת מחדל למישהו חדש.
 */
export default async function AdminPackagesPage() {
  await requireAdmin();
  const packages = await listFeaturePackages();
  const templates = packages.filter((p) => p.is_template);
  const custom = packages.filter((p) => !p.is_template);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.6rem]">חבילות</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            ההרכב שממנו מתחיל דייר חדש — ואפשר להחיל שוב על דייר קיים.
          </p>
        </div>
        <Link
          href="/admin/packages/new"
          className="rounded-md px-4 py-2 text-[0.88rem] font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
        >
          חבילה חדשה
        </Link>
      </div>

      <PackageSection title="תבניות" note="מוצעות כברירת מחדל בהקמת דייר." items={templates} />
      <PackageSection title="חד-פעמיות" note="הרכבה ייעודית ללקוח אחד — לא מוצעת למישהו אחר." items={custom} />
    </div>
  );
}

function PackageSection({
  title, note, items,
}: {
  title: string;
  note: string;
  items: Array<{ id: string; name: string; description: string | null; module_ids: string[] }>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">{title}</h2>
        <p className="mt-0.5 text-[0.76rem] text-muted">{note}</p>
      </header>
      <ul className="divide-y divide-hairline">
        {items.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/packages/${p.id}`} className="text-[0.9rem] hover:underline">
                  {p.name}
                </Link>
                <StatusPill tone="neutral">{p.module_ids.length} מודולים</StatusPill>
              </div>
              {p.description ? <p className="mt-0.5 text-[0.76rem] text-muted">{p.description}</p> : null}
            </div>
            <Link
              href={`/admin/packages/${p.id}`}
              className="rounded-sm border border-strong px-3 py-1 text-[0.78rem] text-secondary transition-colors hover:bg-sunken"
            >
              עריכה
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
