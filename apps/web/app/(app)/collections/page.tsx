import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  asPrincipal, lastDunning, listInvoices, listPromises, publishEvent, recordDunning, recordPromise,
} from '@bossi/db';
import {
  ACTION_LABELS, aging, can, casesFromInvoices, collectionQueue, formatILS,
  type CollectionAction, type ScoredCase,
} from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';


export const dynamic = 'force-dynamic';
export const metadata = { title: 'גבייה' };

/**
 * על מי להתקשר היום.
 *
 * הרשימה **אינה** ממוינת לפי גובה החוב. חוב גדול של מי שמשלם באיחור של
 * שבוע כל חודש הוא לא בעיה; חוב בינוני של מי שהבטיח ולא עמד — הוא כן.
 * התעדוף עצמו יושב ב-core ונבדק שם; המסך רק מציג אותו ומסביר למה.
 */
export default async function CollectionsPage() {
  const principal = await requirePrincipal();
  const canSend = can(principal.role, 'collections.send');

  const [invoices, promises, contacts] = await Promise.all([
    asPrincipal(principal, (tx) => listInvoices(tx, { openOnly: true })),
    asPrincipal(principal, (tx) => listPromises(tx)),
    asPrincipal(principal, (tx) => lastDunning(tx)),
  ]);

  // ההבטחה **האחרונה** לכל לקוח היא הקובעת. הבטחה משנה שעברה אינה
  // עדות למה שקורה עכשיו, והצגתה תדחוף לתור אנשים שכבר סגרו.
  const latestPromise = new Map<string, (typeof promises)[number]>();
  for (const p of promises) if (!latestPromise.has(p.customer_id)) latestPromise.set(p.customer_id, p);
  const lastContact = new Map(contacts.map((c) => [c.customer_id, c.sent_at]));

  const queue = collectionQueue(
    casesFromInvoices(invoices).map((c) => {
      const promise = latestPromise.get(c.customerId);
      return {
        ...c,
        promise: promise ? { promisedFor: promise.promised_for, status: promise.status } : null,
        lastContactAt: lastContact.get(c.customerId) ?? null,
      };
    }),
  );

  const book = aging(invoices);
  const today = queue.filter((c) => c.action === 'call_now' || c.action === 'escalate');
  const later = queue.filter((c) => c.action !== 'call_now' && c.action !== 'escalate');

  async function sendReminder(customerId: string, formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'collections.send')) throw new Error('אין הרשאה לשלוח תזכורות');
    const channel = String(formData.get('channel') ?? 'whatsapp');

    await asPrincipal(principal, async (tx) => {
      await recordDunning(tx, { customerId, channel, tone: 'neutral', step: 1 });
      await publishEvent(tx, {
        type: 'collections.reminder_sent',
        actorType: 'user',
        actorId: principal.userId,
        customerId,
        payload: { channel },
      });
    });
    revalidatePath('/collections');
  }

  async function logPromise(customerId: string, formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'collections.send')) throw new Error('אין הרשאה לרשום הבטחה');
    const promisedFor = String(formData.get('promisedFor') ?? '');
    if (!promisedFor) return;

    await asPrincipal(principal, async (tx) => {
      await recordPromise(tx, { customerId, promisedFor, channel: 'phone' });
      await publishEvent(tx, {
        type: 'collections.promise_made',
        actorType: 'user',
        actorId: principal.userId,
        customerId,
        payload: { date: promisedFor },
      });
    });
    revalidatePath('/collections');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">גבייה</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {today.length === 0
            ? 'אין למי להתקשר היום.'
            : `${today.length} ${today.length === 1 ? 'שיחה' : 'שיחות'} להיום · ${formatILS(
                today.reduce((s, c) => s + c.balance, 0),
              )} ₪`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="חוב באיחור" value={`${formatILS(book.overdue)} ₪`} note={`${book.overdueCount} חשבוניות`} />
        <StatTile label="תיקים פתוחים" value={String(queue.length)} note="לקוחות עם חוב באיחור" />
        <StatTile
          label="הבטחות פתוחות"
          value={String(queue.filter((c) => c.action === 'wait_promise').length)}
          note="ממתינים לתאריך שנקבע"
        />
        <StatTile
          label="להסלמה"
          value={String(queue.filter((c) => c.action === 'escalate').length)}
          note="מעל 90 יום"
        />
      </div>

      <Queue
        title="להתקשר היום"
        hint="לפי דחיפות אמיתית — הבטחה שהופרה קודמת לחוב גדול יותר"
        cases={today}
        canSend={canSend}
        onRemind={sendReminder}
        onPromise={logPromise}
        empty="אין תיק שדורש שיחה היום."
      />

      {later.length > 0 ? (
        <Queue
          title="לא היום"
          hint="הבטיחו, דובר איתם לאחרונה, או שהגבייה מהם מושהית"
          cases={later}
          canSend={canSend}
          onRemind={sendReminder}
          onPromise={logPromise}
          empty=""
          quiet
        />
      ) : null}
    </div>
  );
}

function Queue({
  title, hint, cases, canSend, onRemind, onPromise, empty, quiet,
}: {
  title: string;
  hint: string;
  cases: ScoredCase[];
  canSend: boolean;
  onRemind: (customerId: string, formData: FormData) => Promise<void>;
  onPromise: (customerId: string, formData: FormData) => Promise<void>;
  empty: string;
  quiet?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">
          {title} <span className="tnum text-[0.8rem] text-muted">({cases.length})</span>
        </h2>
        <p className="mt-0.5 text-[0.76rem] text-muted">{hint}</p>
      </header>

      {cases.length === 0 ? (
        <p className="px-4 py-10 text-center text-[0.88rem] text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {cases.map((c) => (
            <li key={c.customerId} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/customers/${c.customerId}`} className="text-[0.92rem] font-medium hover:underline">
                    {c.customerName}
                  </Link>
                  <StatusPill tone={toneOf(c.action)}>{ACTION_LABELS[c.action]}</StatusPill>
                </div>
                <p className="mt-1 text-[0.78rem] text-secondary">{c.reason}</p>
              </div>

              <div className="shrink-0 text-end">
                <div className="tnum text-[1.05rem] font-semibold leading-none">{formatILS(c.balance)} ₪</div>
                <div className="mt-1 text-[0.72rem] text-muted">
                  {c.invoiceCount} {c.invoiceCount === 1 ? 'חשבונית' : 'חשבוניות'} · ותיקה {c.oldestDays} יום
                </div>
              </div>

              {canSend && !quiet ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <form action={onRemind.bind(null, c.customerId)}>
                    <input type="hidden" name="channel" value="whatsapp" />
                    <button
                      type="submit"
                      className="rounded-sm border border-strong px-2.5 py-1 text-[0.76rem] text-secondary transition-colors hover:bg-sunken"
                    >
                      תזכורת
                    </button>
                  </form>
                  <form action={onPromise.bind(null, c.customerId)} className="flex items-center gap-1">
                    <input
                      type="date"
                      name="promisedFor"
                      required
                      // ברירת מחדל של שבוע קדימה: השדה מתמלא בלחיצה אחת
                      // במקרה הנפוץ, ולא נראה כשדה ריק בפורמט זר.
                      defaultValue={inDays(7)}
                      min={inDays(0)}
                      aria-label={`תאריך שהבטיח ${c.customerName}`}
                      className="w-32 rounded-sm border border-hairline bg-transparent px-1.5 py-1 text-[0.74rem]"
                    />
                    <button
                      type="submit"
                      className="rounded-sm border border-strong px-2.5 py-1 text-[0.76rem] text-secondary transition-colors hover:bg-sunken"
                    >
                      הבטיח
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function toneOf(action: CollectionAction): 'danger' | 'warning' | 'positive' | 'neutral' {
  if (action === 'escalate') return 'danger';
  if (action === 'call_now') return 'warning';
  if (action === 'wait_promise') return 'positive';
  return 'neutral';
}

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}
