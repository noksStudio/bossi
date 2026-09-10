import Link from 'next/link';
import { asPrincipal, listPortalUsers } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { loadShell } from '@/lib/navigation';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'פורטל לקוחות' };

/**
 * ניהול הגישה של הלקוחות.
 *
 * `portal_users` היא טבלה נפרדת מ-`users` ולא תפקיד עליה (CLAUDE.md
 * כלל 2). זה נראה כמו כפילות עד הרגע שבו באג הרשאות אחד בצד הצוות
 * היה פותח דלת ללקוח — ואז זה נראה כמו ההחלטה הנכונה היחידה.
 *
 * מה שהלקוח רואה בפורטל נקבע מההרכבה של הדייר, לא מהגדרה נפרדת: פורטל
 * הזמנות בלי מודול הזמנות אינו אפשרי, ולכן גם אינו מוצע.
 */
export default async function PortalSettingsPage() {
  const principal = await requirePrincipal();
  const shell = await loadShell(principal);
  const users = await asPrincipal(principal, (tx) => listPortalUsers(tx));

  const active = users.filter((u) => u.status === 'active');
  const invited = users.filter((u) => u.status === 'invited');
  const customers = new Set(users.map((u) => u.customer_id));
  const seen30 = active.filter(
    (u) => u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 30 * 86_400_000,
  );

  const surfaces = [
    { module: 'documents', label: 'המסמכים שלי', detail: 'כל מסמך שתויק ללקוח, עם הורדה' },
    { module: 'billing', label: 'חשבוניות ויתרה', detail: 'חשבוניות פתוחות, היסטוריית תשלומים' },
    { module: 'orders', label: 'הזמנות ועגלה', detail: 'הזמנה חוזרת, מחיר פר-לקוח, מלאי זמין' },
  ].filter((s) => shell.modules.includes(s.module));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">פורטל לקוחות</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {users.length === 0
            ? 'עוד לא הוזמנו משתמשים.'
            : `${users.length} משתמשים אצל ${customers.size} לקוחות`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="פעילים" value={String(active.length)} />
        <StatTile label="הוזמנו ולא נכנסו" value={String(invited.length)} note={invited.length ? 'שווה תזכורת' : 'כולם נכנסו'} />
        <StatTile label="נכנסו החודש" value={String(seen30.length)} note="30 יום אחרונים" />
        <StatTile label="לקוחות עם גישה" value={String(customers.size)} />
      </div>

      <section className="rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">מה הלקוח רואה</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">נגזר מהמודולים הפעילים — לא מהגדרה נפרדת שיכולה לסתור אותם</p>
        </header>
        <ul className="divide-y divide-hairline">
          {surfaces.map((s) => (
            <li key={s.module} className="flex items-center gap-3 px-4 py-3">
              <StatusPill tone="positive">פעיל</StatusPill>
              <div className="min-w-0 flex-1">
                <div className="text-[0.88rem]">{s.label}</div>
                <div className="text-[0.74rem] text-muted">{s.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">משתמשים</h2>
        </header>

        {users.length === 0 ? (
          <p className="px-4 py-10 text-center text-[0.88rem] text-muted">
            הזמינו איש קשר מכרטיס הלקוח כדי לפתוח לו גישה.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-[0.85rem]">
              <thead>
                <tr className="border-b border-hairline text-[0.72rem] text-muted">
                  <th className="px-4 py-2 text-start font-normal">משתמש</th>
                  <th className="px-4 py-2 text-start font-normal">לקוח</th>
                  <th className="px-4 py-2 text-start font-normal">הרשאות</th>
                  <th className="px-4 py-2 text-start font-normal">כניסה אחרונה</th>
                  <th className="px-4 py-2 text-start font-normal">מצב</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-sunken">
                    <td className="px-4 py-2.5">
                      <div>{u.name}</div>
                      <div className="text-[0.7rem] text-muted" dir="ltr">{u.email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/customers/${u.customer_id}`} className="hover:underline">
                        {u.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[0.78rem] text-secondary">
                      {u.permissions.length === 0
                        ? '—'
                        : u.permissions.map((p) => PERMISSIONS[p] ?? p).join(' · ')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[0.78rem] text-muted">
                      {u.last_seen_at ? formatDate(u.last_seen_at) : 'מעולם'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <StatusPill tone={u.status === 'active' ? 'positive' : u.status === 'invited' ? 'warning' : 'neutral'}>
                        {STATUS[u.status] ?? u.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const STATUS: Record<string, string> = { active: 'פעיל', invited: 'הוזמן', revoked: 'בוטל' };
const PERMISSIONS: Record<string, string> = {
  'documents.read': 'מסמכים',
  'invoices.read': 'חשבוניות',
  'orders.read': 'צפייה בהזמנות',
  'orders.place': 'הגשת הזמנה',
};
