import { requirePrincipal } from '@/lib/session';
import { loadShell, moduleName, moduleOf } from '@/lib/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לוח הבקרה' };

/**
 * הדשבורד מורכב מתרומות `slots` של המודולים הפעילים — הוא לא יודע
 * מראש מה יופיע בו, ואין בו שום `if (hasRetainers)`.
 *
 * כרגע כל תרומה מוצגת כמסגרת עם שם המודול שתרם אותה. הגופים האמיתיים
 * נכנסים בספרינטים 4–10, כל אחד במקום שכבר שמור לו כאן.
 */
export default async function DashboardPage() {
  const principal = await requirePrincipal();
  const shell = await loadShell(principal);
  const widgets = shell.slots('dashboard.widgets');

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[1.6rem]">{greeting()}, {principal.name.split(' ')[0]}</h1>
        <p className="mt-1 text-[0.88rem] text-muted">{today()}</p>
      </div>

      {widgets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w) => (
            <section key={w.id} className="rounded-lg border border-hairline bg-raised p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[1rem]">{w.label ?? w.id}</h2>
                <span className="shrink-0 text-[0.7rem] text-muted">{moduleName(moduleOf(w.id))}</span>
              </div>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-muted">
                נבנה בספרינט הקרוב. המקום שמור לו כאן על ידי המודול.
              </p>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-lg border border-hairline p-5">
        <h2 className="text-[0.95rem]">ההרכבה שלך</h2>
        <p className="mt-1.5 text-[0.82rem] text-muted">
          המודולים שדלוקים אצלך. התפריט מימין נבנה מהם.
        </p>
        <ul className="mt-3.5 flex flex-wrap gap-1.5">
          {shell.modules.map((id) => (
            <li
              key={id}
              className="rounded-full border border-hairline px-2.5 py-1 text-[0.78rem] text-secondary"
            >
              {moduleName(id)}
              {shell.autoAdded.includes(id) ? (
                <span className="ms-1.5 text-[0.68rem] text-muted">נדרש</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-strong p-10 text-center">
      <h2 className="text-[1.05rem]">עוד אין מה להראות כאן</h2>
      <p className="mx-auto mt-2 max-w-md text-[0.88rem] leading-relaxed text-secondary">
        ברגע שיכנסו המסמכים הראשונים, המסך הזה יתחיל לענות על שלוש שאלות:
        מה נכנס, מה דורש אותך, ומי נשכח.
      </p>
    </div>
  );
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('he-IL', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jerusalem' }).format(
      new Date(),
    ),
  );
  if (hour < 12) return 'בוקר טוב';
  if (hour < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

function today(): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date());
}
