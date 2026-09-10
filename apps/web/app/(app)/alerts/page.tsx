import { countBySeverity } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { loadShell } from '@/lib/navigation';
import { loadAlerts } from '@/lib/alerts';
import { AlertList } from '@/components/app/alert-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'התראות' };

/**
 * כל מה שדורש החלטה, במקום אחד ולפי דחיפות.
 *
 * מחולק לשלוש קבוצות ולא לפי מודול: מי שפותח את המסך הזה בבוקר רוצה
 * לדעת מה בוער, לא איזה מודול צעק.
 */
export default async function AlertsPage() {
  const principal = await requirePrincipal();
  const shell = await loadShell(principal);
  const alerts = await loadAlerts(principal, shell);
  const counts = countBySeverity(alerts);

  const groups = [
    { key: 'critical' as const, title: 'דחוף', hint: 'כסף או זכות שכבר נפגעו, או שייפגעו השבוע' },
    { key: 'attention' as const, title: 'לטפל', hint: 'יש עוד זמן, אבל לא הרבה' },
    { key: 'info' as const, title: 'לידיעה', hint: 'שווה לדעת, לא דורש פעולה היום' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">התראות</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {alerts.length === 0
            ? 'אין מה שדורש אותך'
            : `${counts.critical + counts.attention} דורשים החלטה · ${counts.info} לידיעה`}
        </p>
      </div>

      {groups.map((g) => {
        const items = alerts.filter((a) => a.severity === g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key} className="overflow-hidden rounded-lg border border-hairline">
            <header className="border-b border-hairline px-4 py-3">
              <h2 className="text-[0.98rem]">
                {g.title} <span className="tnum text-[0.8rem] text-muted">({items.length})</span>
              </h2>
              <p className="mt-0.5 text-[0.76rem] text-muted">{g.hint}</p>
            </header>
            <AlertList alerts={items} />
          </section>
        );
      })}

      {alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.05rem]">הכול מסודר</h2>
          <p className="mx-auto mt-2 max-w-md text-[0.88rem] leading-relaxed text-secondary">
            אין מסמך שפג, אין צ׳ק שלא אומת, ואין חוזה שמתקרב למועד ההודעה.
          </p>
        </div>
      ) : null}
    </div>
  );
}
