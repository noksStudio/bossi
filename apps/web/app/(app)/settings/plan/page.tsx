import { METERS, PLANS, PLAN_ORDER, evaluateUsage, utilisation, type MeterId } from '@bossi/modules';
import { asPrincipal, currentSubscription, enabledModules, tenantUsage } from '@bossi/db';
import { formatILS } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { moduleName } from '@/lib/navigation';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'החבילה שלי' };

/**
 * מה אני משלם, מה אני צורך, ומה יקרה אם אמשיך ככה.
 *
 * שלוש מוסכמות שהמסך עומד עליהן:
 *
 *   · **חריגה מוצגת בשקלים, לא באחוזים.** "132% מהמכסה" לא אומר כלום;
 *     "עוד 214 ₪ החודש" אומר הכול.
 *   · **מכסה קשיחה נראית אחרת ממכסה רכה.** האחת חוסמת פעולה, השנייה
 *     מוסיפה לחשבון, וזה ההבדל בין הפתעה להחלטה.
 *   · **המחיר של החבילה הבאה מוצג לצד החריגה בפועל.** לפעמים שדרוג
 *     זול מהחריגה, וזה נתון שהמערכת חייבת לומר בעצמה.
 */
export default async function PlanPage() {
  const principal = await requirePrincipal();

  const [subscription, modules, usage] = await Promise.all([
    asPrincipal(principal, (tx) => currentSubscription(tx)),
    asPrincipal(principal, (tx) => enabledModules(tx)),
    asPrincipal(principal, (tx) => tenantUsage(tx, cycleStart())),
  ]);

  const plan = PLANS[subscription?.plan ?? 'starter'];
  const result = evaluateUsage(plan, usage);
  const nextPlan = PLAN_ORDER[PLAN_ORDER.indexOf(plan.id) + 1];
  const upgrade = nextPlan ? PLANS[nextPlan] : null;
  const upgradeDelta = upgrade ? (upgrade.monthlyPrice - plan.monthlyPrice) * 100 : 0;

  const meters = (Object.keys(METERS) as MeterId[]).filter(
    (m) => plan.quotas[m].limit !== 0 || usage[m] > 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">החבילה שלי</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {plan.name} · מחזור נוכחי מ-{new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' }).format(new Date(cycleStart()))}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="דמי מנוי" value={`${formatILS(plan.monthlyPrice * 100)} ₪`} note="לחודש, ללא מע״מ" />
        <StatTile
          label="חריגה החודש"
          value={`${formatILS(result.totalOverage * 100)} ₪`}
          note={result.totalOverage > 0 ? 'מעבר לדמי המנוי' : 'אין חריגה'}
        />
        <StatTile
          label="צפי לחיוב"
          value={`${formatILS((plan.monthlyPrice + result.totalOverage) * 100)} ₪`}
          note="אם הקצב יימשך"
        />
        <StatTile label="מודולים פעילים" value={String(modules.length)} note={`מתוך ${plan.modules.length} בחבילה`} />
      </div>

      {result.blocked.length > 0 ? (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--danger)', background: 'var(--danger-quiet)' }}>
          <h2 className="text-[0.95rem] font-medium" style={{ color: 'var(--danger)' }}>
            מכסה קשיחה נחצתה
          </h2>
          <p className="mt-1 text-[0.84rem] text-secondary">
            {result.blocked.map((m) => METERS[m].label).join(', ')} — פעולות נוספות ייחסמו עד לשדרוג החבילה.
            מכסה קשיחה אינה מתחייבת בחריגה; היא פשוט נעצרת.
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">צריכה מול מכסה</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            אחסון ומשתמשים נמדדים כמצב רגעי; השאר מתאפס בכל מחזור חיוב.
          </p>
        </header>
        <ul className="divide-y divide-hairline">
          {meters.map((id) => {
            const meter = METERS[id];
            const quota = plan.quotas[id];
            const used = usage[id];
            const ratio = utilisation(plan, id, used);
            const breach = result.breaches.find((b) => b.meter === id);
            return (
              <li key={id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.88rem]">{meter.label}</span>
                    {breach ? (
                      <StatusPill tone={breach.kind === 'hard' ? 'danger' : 'warning'}>
                        {breach.kind === 'hard' ? 'חסום' : `חריגה ${formatILS(breach.overageCharge * 100)} ₪`}
                      </StatusPill>
                    ) : ratio !== null && ratio >= 0.8 ? (
                      <StatusPill tone="warning">מתקרב למכסה</StatusPill>
                    ) : null}
                  </div>
                  <div className="tnum text-[0.85rem]">
                    {/* הזוג עטוף ב-<bdi> כדי שלא יתהפך בפסקה בעברית;
                        היחידה נשארת בחוץ כי היא טקסט עברי לכל דבר. */}
                    {quota.limit === null ? (
                      <>
                        {format(used)} <span className="text-muted">מתוך ללא הגבלה {meter.unit}</span>
                      </>
                    ) : (
                      <>
                        <bdi>{format(used)} / {format(quota.limit)}</bdi>{' '}
                        <span className="text-muted">{meter.unit}</span>
                      </>
                    )}
                  </div>
                </div>
                {ratio !== null ? (
                  <div className="mt-2 h-1.5 rounded-full" style={{ background: 'var(--surface-sunken)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        // ניצול של 0.1% מעוגל ל-0 ונעלם, ואז מד ריק נראה
                        // זהה למד מקולקל. רצועה מינימלית אומרת "נמדד, ונמוך".
                        width: ratio === 0 ? 0 : `max(3px, ${Math.min(100, ratio * 100).toFixed(1)}%)`,
                        background: ratio > 1 ? 'var(--danger)' : ratio >= 0.8 ? 'var(--warning)' : 'var(--positive)',
                      }}
                    />
                  </div>
                ) : null}
                {quota.limit !== null && quota.overagePrice === null && ratio !== null && ratio < 1 ? (
                  <p className="mt-1.5 text-[0.72rem] text-muted">מכסה קשיחה — מעבר לה הפעולה נחסמת ולא מחויבת.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {upgrade ? (
        <section className="rounded-lg border border-hairline p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[1rem]">{upgrade.name}</h2>
              <p className="mt-1 max-w-xl text-[0.85rem] leading-relaxed text-secondary">{upgrade.tagline}</p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-muted">
                {upgrade.highlights.slice(1, 5).map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
            </div>
            <div className="shrink-0 text-end">
              <div className="text-[1.4rem] font-semibold leading-none">
                {/* בלי <bdi> הסימן + קופץ לצד השני של המספר בפסקה בעברית. */}
                <bdi>+{formatILS(upgradeDelta)}</bdi>{' '}
                <span className="text-[0.8rem] font-normal text-muted">₪ לחודש</span>
              </div>
              {result.totalOverage * 100 > upgradeDelta ? (
                <p className="mt-1.5 max-w-52 text-[0.76rem]" style={{ color: 'var(--positive)' }}>
                  החריגה החודש כבר גדולה מהפרש המחיר — שדרוג יוזיל את החשבון.
                </p>
              ) : (
                <p className="mt-1.5 max-w-52 text-[0.76rem] text-muted">
                  בקצב הנוכחי החבילה הזו עדיין מספיקה.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">מה פעיל אצלי</h2>
        </header>
        <div className="flex flex-wrap gap-1.5 p-4">
          {plan.modules.map((m) => {
            const on = modules.includes(m);
            return (
              <span
                key={m}
                className="rounded-full border px-2.5 py-1 text-[0.78rem]"
                style={
                  on
                    ? { borderColor: 'var(--positive)', color: 'var(--positive)', background: 'var(--positive-quiet)' }
                    : { borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }
                }
              >
                {moduleName(m)}
                {on ? '' : ' — כבוי'}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function format(n: number): string {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

/** תחילת מחזור החיוב. ברירת המחדל היא ה-1 בחודש. */
function cycleStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
