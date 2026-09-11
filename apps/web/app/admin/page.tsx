import Link from 'next/link';
import { listTenants, platformStatus } from '@bossi/db';
import { PLANS } from '@bossi/modules';
import { classifyEngagement, ENGAGEMENT_LABELS, ENGAGEMENT_SUGGESTIONS, type EngagementTier } from '@bossi/core';
import { requireAdmin } from '@/lib/platform-session';
import { StatTile, StatusPill } from '@/components/site/chrome';

const ENGAGEMENT_TONE: Record<EngagementTier, 'positive' | 'warning' | 'danger' | 'neutral'> = {
  power: 'positive',
  engaged: 'neutral',
  at_risk: 'warning',
  dormant: 'danger',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'דיירים · ניהול' };

/**
 * כל הדיירים במבט אחד.
 *
 * העמודות הן מטא-דאטה בלבד — כמה, לא מה. אין כאן שם של לקוח ולא
 * כותרת של מסמך, וזה מה שמאפשר לומר לבעל עסק ש-Bossi לא רואה את
 * התיקים שלו.
 */
export default async function AdminTenantsPage() {
  await requireAdmin();

  const [tenants, status] = await Promise.all([listTenants(), platformStatus()]);
  const real = tenants.filter((t) => !t.is_demo);
  const demo = tenants.filter((t) => t.is_demo);
  const mrr = real.reduce((sum, t) => sum + (PLANS[t.plan as keyof typeof PLANS]?.monthlyPrice ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-[1.6rem]">דיירים</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {real.length} עסקים משלמים · {demo.length} דיירי הדגמה
        </p>
      </div>

      {status.reach === 'blocked' ? <ReachWarning /> : null}

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="עסקים משלמים" value={String(real.length)} />
        <StatTile label="הכנסה חודשית" value={`${mrr.toLocaleString('he-IL')} ₪`} note="לפי מחירון החבילות" />
        <StatTile label="מסמכים במערכת" value={status.documents.toLocaleString('he-IL')} />
        {/* המספר והיחידה מופרדים: `StatTile` מקבל מחרוזת ולא JSX, ולכן
            אי אפשר לעטוף ב-<bdi> — והצירוף "1.2 GB" היה מתהפך. */}
        <StatTile
          label="אחסון"
          value={splitBytes(tenants.reduce((s, t) => s + Number(t.storage_bytes), 0)).value}
          note={`${splitBytes(tenants.reduce((s, t) => s + Number(t.storage_bytes), 0)).unit} · סך כל הדיירים`}
        />
      </div>

      <TenantTable title="עסקים" tenants={real} empty="עוד אין עסקים משלמים." />
      {demo.length > 0 ? <TenantTable title="הדגמה" tenants={demo} empty="" /> : null}
    </div>
  );
}

function TenantTable({
  title, tenants, empty,
}: {
  title: string;
  tenants: Awaited<ReturnType<typeof listTenants>>;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">
          {title} <span className="tnum text-[0.8rem] text-muted">({tenants.length})</span>
        </h2>
      </header>

      {tenants.length === 0 ? (
        <p className="px-4 py-10 text-center text-[0.88rem] text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[0.85rem]">
            <thead>
              <tr className="border-b border-hairline text-[0.72rem] text-muted">
                <th className="px-4 py-2 text-start font-normal">עסק</th>
                <th className="px-4 py-2 text-start font-normal">חבילה</th>
                <th className="px-4 py-2 text-end font-normal">מודולים</th>
                <th className="px-4 py-2 text-end font-normal">משתמשים</th>
                <th className="px-4 py-2 text-end font-normal">לקוחות</th>
                <th className="px-4 py-2 text-end font-normal">מסמכים</th>
                <th className="px-4 py-2 text-end font-normal">אחסון</th>
                <th className="px-4 py-2 text-start font-normal">פעילות</th>
                <th className="px-4 py-2 text-start font-normal">מעורבות (14 יום)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {tenants.map((t) => {
                const engagement = classifyEngagement({ logins: t.logins_14d, actions: t.actions_14d });
                return (
                  <tr key={t.id} className="hover:bg-sunken">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/tenants/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                      <div className="text-[0.7rem] text-muted" dir="ltr">{t.slug}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {PLANS[t.plan as keyof typeof PLANS]?.name ?? t.plan}
                    </td>
                    <td className="px-4 py-2.5 text-end tnum text-secondary">{t.modules}</td>
                    <td className="px-4 py-2.5 text-end tnum text-secondary">{t.users}</td>
                    <td className="px-4 py-2.5 text-end tnum text-secondary">{t.customers}</td>
                    <td className="px-4 py-2.5 text-end tnum text-secondary">
                      {t.documents.toLocaleString('he-IL')}
                    </td>
                    <td className="px-4 py-2.5 text-end tnum text-secondary">
                      {/* היחידה לטינית והמספר ניטרלי — בלי <bdi> "20 GB" מוצג "GB 20". */}
                      <bdi>{formatBytes(Number(t.storage_bytes))}</bdi>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[0.78rem] text-muted">
                      {relative(t.last_activity_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <StatusPill tone={ENGAGEMENT_TONE[engagement.tier]}>
                        {ENGAGEMENT_LABELS[engagement.tier]}
                      </StatusPill>
                      <div className="mt-0.5 text-[0.72rem] text-muted">
                        {ENGAGEMENT_SUGGESTIONS[engagement.tier]}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * האזהרה שהופכת כישלון שקט לכישלון רועש.
 *
 * אם תפקיד החיבור כפוף ל-RLS, המסך הזה היה מציג "0 דיירים" על מסד
 * מלא ונראה תקין לחלוטין. עדיף לומר במפורש שמשהו חוסם.
 */
function ReachWarning() {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--danger)', background: 'var(--danger-quiet)' }}>
      <h2 className="text-[0.95rem] font-medium" style={{ color: 'var(--danger)' }}>
        נתיב הפלטפורמה חסום
      </h2>
      <p className="mt-1 text-[0.84rem] leading-relaxed text-secondary">
        יש דיירים במסד, אבל השאילתה חוצת-הדיירים אינה מחזירה שורות. המשמעות היא שתפקיד
        החיבור כפוף ל-RLS, והמספרים במסך הזה אינם אמינים. זו אינה תקלת תצוגה — היא גם
        שוברת את קליטת המשתמשים, כי אותו נתיב מפענח כל חיבור.
      </p>
    </div>
  );
}

/** מפריד מספר מיחידה, לשימוש במקומות שמקבלים מחרוזת ולא JSX. */
function splitBytes(bytes: number): { value: string; unit: string } {
  const text = formatBytes(bytes);
  const [value = text, unit = ''] = text.split(' ');
  return { value, unit };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function relative(at: Date | null): string {
  if (!at) return 'מעולם';
  const hours = Math.round((Date.now() - new Date(at).getTime()) / 3_600_000);
  if (hours < 1) return 'הרגע';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
}
