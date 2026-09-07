import Link from 'next/link';
import {
  asPrincipal, documentStats, expiringDocuments, listCustomers, quietCustomers, recentIntake,
} from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { loadShell, moduleName, moduleOf } from '@/lib/navigation';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { daysUntil, docTypeLabel, sourceLabel } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לוח הבקרה' };

/**
 * הדשבורד עונה על שלוש שאלות ולא יותר: מה נכנס, מה דורש אותי, ומי נשכח.
 * ווידג׳טים של מודולים שטרם נבנו מוצגים כמקומות שמורים, כדי שיהיה ברור
 * מה עוד עתיד להיכנס לכאן ומי תרם אותו.
 */
export default async function DashboardPage() {
  const principal = await requirePrincipal();
  const shell = await loadShell(principal);

  const [stats, expiring, intake, quiet, customers] = await Promise.all([
    asPrincipal(principal, (tx) => documentStats(tx)),
    asPrincipal(principal, (tx) => expiringDocuments(tx, 60)),
    asPrincipal(principal, (tx) => recentIntake(tx, 6)),
    asPrincipal(principal, (tx) => quietCustomers(tx, 60, 5)),
    asPrincipal(principal, (tx) => listCustomers(tx, { status: 'active', limit: 500 })),
  ]);

  const built = new Set(['metering.usage_bar']);
  const placeholders = shell.slots('dashboard.widgets').filter((w) => !built.has(w.id));

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[1.6rem]">
          {greeting()}, {principal.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {today()} · {attentionLine(expiring.length + stats.needs_review)}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="לקוחות פעילים" value={String(customers.length)} />
        <StatTile label="מסמכים החודש" value={stats.this_month.toLocaleString('he-IL')} note={`${stats.total.toLocaleString('he-IL')} סה״כ`} />
        <StatTile label="ממתין לאישור" value={String(stats.needs_review)} note={stats.needs_review > 0 ? 'כמה דקות עבודה' : 'הכל מסודר'} />
        <StatTile label="לא נגעת בהם" value={String(quiet.length)} note="מעל 60 יום" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">דורש תשומת לב</h2>
          </header>
          {expiring.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.88rem] text-muted">אין מסמכים שתוקפם פג בקרוב.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {expiring.slice(0, 6).map((d) => {
                const days = daysUntil(d.expires_on)!;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <StatusPill tone={days <= 14 ? 'danger' : 'warning'}>
                      {days < 0 ? 'פג' : `${days} יום`}
                    </StatusPill>
                    <div className="min-w-0 flex-1">
                      <Link href={`/documents/${d.id}`} className="text-[0.88rem] hover:underline">
                        {d.title}
                      </Link>
                      <div className="text-[0.72rem] text-muted">{d.customer_name}</div>
                    </div>
                    <button className="shrink-0 rounded-sm border border-strong px-2 py-1 text-[0.72rem] text-secondary">
                      בקש חדש
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">נכנס לאחרונה · תויק לבד</h2>
          </header>
          <ul className="divide-y divide-hairline">
            {intake.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 px-4 py-2.5 text-[0.84rem]">
                <span
                  className="w-16 shrink-0 rounded-sm px-1.5 py-0.5 text-center text-[0.66rem]"
                  style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}
                >
                  {sourceLabel(d.source)}
                </span>
                <Link href={`/documents/${d.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {d.title}
                </Link>
                <span className="shrink-0 text-[0.72rem] text-muted">← {d.customer_name}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {quiet.length > 0 ? (
        <section className="rounded-lg border border-hairline">
          <header className="border-b border-hairline px-4 py-3">
            <h2 className="text-[0.98rem]">מי נשכח</h2>
            <p className="mt-0.5 text-[0.76rem] text-muted">לקוחות פעילים שלא קרה איתם כלום זמן רב</p>
          </header>
          <ul className="divide-y divide-hairline">
            {quiet.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/customers/${c.id}`} className="min-w-0 flex-1 truncate text-[0.88rem] hover:underline">
                  {c.display_name}
                </Link>
                <span className="shrink-0 text-[0.78rem] text-muted">
                  {c.days_quiet >= 999 ? 'מעולם' : `לפני ${c.days_quiet} יום`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {placeholders.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[0.9rem] text-muted">מקומות שמורים למודולים הפעילים</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {placeholders.map((w) => (
              <div key={w.id} className="rounded-lg border border-dashed border-hairline p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[0.92rem]">{w.label ?? w.id}</h3>
                  <span className="shrink-0 text-[0.7rem] text-muted">{moduleName(moduleOf(w.id))}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function attentionLine(n: number): string {
  if (n === 0) return 'אין מה שדורש אותך היום';
  if (n === 1) return 'דבר אחד דורש אותך';
  return `${n} דברים דורשים אותך`;
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('he-IL', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date()),
  );
  if (hour < 12) return 'בוקר טוב';
  if (hour < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

function today(): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem',
  }).format(new Date());
}
