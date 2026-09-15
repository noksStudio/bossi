import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  advanceProductionStage, asPrincipal, listProductionQueue, markProductionNotified,
  publishEvent, type ProductionLineRow, type ProductionStage,
} from '@bossi/db';
import { can } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { waLink } from '@/lib/whatsapp';
import { WhatsAppReadyButton } from '@/components/app/whatsapp-ready-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לוח ייצור' };

const STAGES: Array<{ id: ProductionStage; label: string }> = [
  { id: 'started', label: 'תחילת עבודה' },
  { id: 'near_completion', label: 'לקראת סיום' },
  { id: 'ready', label: 'מוכן' },
];

/**
 * לוח הייצור — מסך נפרד מ-`/orders` בכוונה, כי המשתמש היחיד שלו הוא
 * לרוב עובד ייצור עם הרשאת `orders.production` בלבד (ADR-028), בלי
 * `orders.read`. 404 ולא הפניה להתחברות: מי שאין לו הרשאה לא צריך
 * לדעת שהמסך הזה בכלל קיים.
 *
 * רק שורות מהזמנות שאושרו — עבודה לא מתחילה לפני שער האישור.
 */
export default async function ProductionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ color?: string; jobType?: string }>;
}) {
  const principal = await requirePrincipal();
  if (!can(principal.role, 'orders.production', principal.overrides)) notFound();

  const { color, jobType } = await searchParams;

  const [all, filtered] = await Promise.all([
    asPrincipal(principal, (tx) => listProductionQueue(tx)),
    asPrincipal(principal, (tx) => listProductionQueue(tx, { color, jobType })),
  ]);

  const colors = [...new Set(all.map((l) => l.color).filter((c): c is string => Boolean(c)))].sort();
  const jobTypes = [...new Set(all.map((l) => l.job_type).filter((j): j is string => Boolean(j)))].sort();

  async function setStage(lineId: string, stage: ProductionStage) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'orders.production', principal.overrides)) throw new Error('אין הרשאה ללוח הייצור');
    await asPrincipal(principal, async (tx) => {
      const result = await advanceProductionStage(tx, lineId, stage);
      if (result && stage === 'ready') {
        await publishEvent(tx, {
          type: 'orders.line_ready', actorType: 'user', actorId: principal.userId,
          subjectType: 'order', subjectId: result.orderId, payload: {},
        });
      }
    });
    revalidatePath('/orders/production');
  }

  async function notify(lineId: string) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'orders.production', principal.overrides)) throw new Error('אין הרשאה ללוח הייצור');
    await asPrincipal(principal, (tx) => markProductionNotified(tx, lineId));
    revalidatePath('/orders/production');
  }

  const byStage = (stage: ProductionStage) => filtered.filter((l) => l.production_stage === stage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">לוח ייצור</h1>
        <p className="mt-1 text-[0.88rem] text-muted">שורות מהזמנות שאושרו, לפי שלב עבודה.</p>
      </div>

      {(colors.length > 0 || jobTypes.length > 0) ? (
        <form className="flex flex-wrap items-end gap-2.5">
          {colors.length > 0 ? (
            <label>
              <span className="block text-[0.72rem] text-muted">צבע</span>
              <select name="color" defaultValue={color ?? ''} className="mt-0.5 rounded-md border border-strong bg-raised px-2.5 py-1.5 text-[0.85rem] outline-none">
                <option value="">הכול</option>
                {colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : null}
          {jobTypes.length > 0 ? (
            <label>
              <span className="block text-[0.72rem] text-muted">סוג עבודה</span>
              <select name="jobType" defaultValue={jobType ?? ''} className="mt-0.5 rounded-md border border-strong bg-raised px-2.5 py-1.5 text-[0.85rem] outline-none">
                <option value="">הכול</option>
                {jobTypes.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>
          ) : null}
          <button type="submit" className="rounded-md border border-strong px-3.5 py-1.5 text-[0.82rem]">סינון</button>
          {(color || jobType) ? <Link href="/orders/production" className="text-[0.8rem] text-muted hover:underline">איפוס</Link> : null}
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {STAGES.map((s) => {
          const lines = byStage(s.id);
          return (
            <section key={s.id} className="overflow-hidden rounded-lg border border-hairline">
              <header className="border-b border-hairline bg-sunken px-4 py-2.5">
                <h2 className="text-[0.9rem]">
                  {s.label} <span className="tnum text-[0.76rem] text-muted">({lines.length})</span>
                </h2>
              </header>
              {lines.length === 0 ? (
                <p className="px-4 py-8 text-center text-[0.82rem] text-muted">אין שורות בשלב הזה.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {lines.map((l) => (
                    <li key={l.id}>
                      <ProductionCard line={l} setStage={setStage} notify={notify} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ProductionCard({
  line, setStage, notify,
}: {
  line: ProductionLineRow;
  setStage: (lineId: string, stage: ProductionStage) => Promise<void>;
  notify: (lineId: string) => Promise<void>;
}) {
  const wa = line.customer_phone
    ? waLink(line.customer_phone, `שלום, ההזמנה שלך ${line.order_number} (${line.name}) מוכנה!`)
    : null;

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[0.9rem] font-medium">{line.customer_name}</span>
        <span className="tnum text-[0.74rem] text-muted">{line.order_number}</span>
      </div>
      <div className="text-[0.84rem] text-secondary">
        {line.name} <span className="tnum text-muted">× {Number(line.quantity).toLocaleString('he-IL')}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {line.color ? <Badge>{line.color}</Badge> : null}
        {line.job_type ? <Badge>{line.job_type}</Badge> : null}
        {line.needed_by ? (
          <Badge tone="muted">דרוש עד {new Date(line.needed_by).toLocaleDateString('he-IL')}</Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {STAGES.map((s) => (
          <form key={s.id} action={setStage.bind(null, line.id, s.id)}>
            <button
              type="submit"
              disabled={line.production_stage === s.id}
              className="rounded-md border px-2.5 py-1 text-[0.74rem] disabled:cursor-default"
              style={
                line.production_stage === s.id
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-quiet)' }
                  : { borderColor: 'var(--border-strong)' }
              }
            >
              {s.label}
            </button>
          </form>
        ))}

        {line.production_stage === 'ready' && !line.notified_at && wa ? (
          <WhatsAppReadyButton href={wa} lineId={line.id} markNotified={notify} />
        ) : null}
        {line.notified_at ? <span className="text-[0.72rem] text-muted">✓ נשלחה התראה ללקוח</span> : null}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'muted' }) {
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 text-[0.7rem]"
      style={{ background: 'var(--surface-sunken)', color: tone === 'muted' ? 'var(--text-muted)' : 'var(--text-secondary)' }}
    >
      {children}
    </span>
  );
}
