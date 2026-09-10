import { revalidatePath } from 'next/cache';
import {
  migrate, platformStatus, recentAudit, recordAudit, resetDemo, seedDemo, seedRealEstate, withPlatform,
} from '@bossi/db';
import { requireAdmin } from '@/lib/platform-session';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: 'מערכת · ניהול' };

/**
 * מצב המסד ופעולות התחזוקה — המסך שהחליף את `BOOTSTRAP_SECRET`.
 *
 * הסוד בכתובת היה עובד, אבל הוא היה מנגנון שאי אפשר לתעד ואי אפשר
 * לבטל: מי שהעתיק את ה-URL פעם אחת מחזיק אותו לתמיד. כאן כל פעולה
 * דורשת חיבור פעיל, נרשמת עם הכתובת של מי שביצע, וניתנת לניתוק.
 *
 * **הזריעה מסרבת לרוץ כשיש דייר אמיתי אחד ולו.** זה אותו מנעול שהיה
 * בנתיב הישן, והוא נשאר: הוא מגן על נתונים של לקוח משלם מפני טעות
 * שלי, לא רק מפני תוקף.
 */
export default async function AdminSystemPage() {
  const admin = await requireAdmin();
  const [status, audit] = await Promise.all([platformStatus(), recentAudit(25)]);

  const locked = status.realTenants > 0;

  async function runMigrations() {
    'use server';
    const admin = await requireAdmin();
    const log: string[] = [];
    const ran = await migrate((m) => log.push(m.trim()));
    await recordAudit({ kind: 'migrate', email: admin.email, detail: { ran: ran.length, log } });
    revalidatePath('/admin/system');
  }

  async function reseedDemo() {
    'use server';
    const admin = await requireAdmin();

    // המנעול נבדק כאן ולא רק ב-UI: כפתור מוסתר אינו הגנה.
    const { rows } = await withPlatform((tx) =>
      tx.query<{ n: string }>('select count(*)::text as n from tenants where is_demo = false'),
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      await recordAudit({ kind: 'seed_refused', email: admin.email, detail: { reason: 'real tenants exist' } });
      return;
    }

    const log: string[] = [];
    const say = (m: string) => log.push(m.trim());
    await migrate(say);
    await resetDemo(say);
    await seedDemo(say);
    await seedRealEstate(say);
    await recordAudit({ kind: 'demo_seeded', email: admin.email, detail: { log } });
    revalidatePath('/admin/system');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-[1.6rem]">מערכת</h1>
        <p className="mt-1 text-[0.88rem] text-muted">מצב המסד, מיגרציות ותיעוד פעולות</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="מיגרציות שהורצו" value={String(status.migrations)} />
        <StatTile label="דיירים" value={String(status.tenants)} note={`${status.realTenants} אמיתיים`} />
        <StatTile label="מסמכים" value={status.documents.toLocaleString('he-IL')} />
        <StatTile
          label="נתיב הפלטפורמה"
          value={status.reach === 'ok' ? 'תקין' : status.reach === 'blocked' ? 'חסום' : 'אין סכמה'}
          note={status.reach === 'ok' ? 'רואה חוצה-דיירים' : 'בדקו את תפקיד החיבור'}
        />
      </div>

      <section className="rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">מיגרציות</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            קדימה בלבד. הרצה חוזרת אינה עושה דבר אם הכול כבר הורץ.
          </p>
        </header>
        <form action={runMigrations} className="p-4">
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-[0.85rem] font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
          >
            הרץ מיגרציות
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="flex flex-wrap items-center gap-2 text-[0.98rem]">
            דיירי הדגמה
            {locked ? <StatusPill tone="danger">נעול</StatusPill> : null}
          </h2>
          <p className="mt-0.5 text-[0.76rem] leading-relaxed text-muted">
            {locked
              ? `במסד יש ${status.realTenants} דיירים אמיתיים. הזריעה מסרבת לרוץ — היא מוחקת ובונה מחדש, ולא תיגע בנתונים של לקוח משלם.`
              : 'מוחק את דיירי ההדגמה ובונה אותם מחדש. דיירים אמיתיים אינם נוגעים — ואם קיים ולו אחד, הפעולה נחסמת לגמרי.'}
          </p>
        </header>
        <form action={reseedDemo} className="p-4">
          <button
            type="submit"
            disabled={locked}
            className="rounded-md border border-strong px-3 py-1.5 text-[0.85rem] text-secondary transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
          >
            זרע מחדש את ההדגמה
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">תיעוד</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            כל פעולת ניהול וכל ניסיון התחברות שנכשל. הטבלה אינה ניתנת לעריכה או למחיקה.
          </p>
        </header>
        {audit.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.88rem] text-muted">אין רישומים.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.84rem]">
                <span className="w-32 shrink-0 text-[0.74rem] text-muted">{when(row.at)}</span>
                <StatusPill tone={row.kind === 'login_failed' || row.kind === 'seed_refused' ? 'danger' : 'neutral'}>
                  {KINDS[row.kind] ?? row.kind}
                </StatusPill>
                <span className="min-w-0 flex-1 truncate text-secondary">
                  {row.tenant_name ?? ''}
                  {row.detail && typeof row.detail['module'] === 'string' ? ` · ${row.detail['module']}` : ''}
                  {row.detail && typeof row.detail['plan'] === 'string' ? ` · ${row.detail['plan']}` : ''}
                </span>
                {row.ip ? (
                  <span className="shrink-0 text-[0.72rem] text-muted" dir="ltr">{row.ip}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[0.76rem] text-muted">
        מחובר כ-<span dir="ltr">{admin.email}</span>. החיבור פג אחרי שמונה שעות.
      </p>
    </div>
  );
}

const KINDS: Record<string, string> = {
  login_ok: 'התחברות',
  login_failed: 'התחברות נכשלה',
  logout: 'יציאה',
  migrate: 'מיגרציות',
  demo_seeded: 'זריעת הדגמה',
  seed_refused: 'זריעה נחסמה',
  plan_changed: 'שינוי חבילה',
  module_enabled: 'מודול הודלק',
  module_disabled: 'מודול כובה',
};

function when(at: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(at));
}
