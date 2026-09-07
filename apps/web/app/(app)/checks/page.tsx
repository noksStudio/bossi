import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { asPrincipal, checksForMonth, markCheck, overdueChecks, publishEvent } from '@bossi/db';
import { can, displayStatus, formatILS, monthWindow, reconcile, shiftMonth, toAgorot } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { CheckRowItem } from '@/components/app/check-row';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'צ׳קים' };

/**
 * ההתאמה החודשית — המסך שנפתח לצד דף הבנק.
 *
 * שני חלקים בכוונה: מה שעבר מועד (נגרר מחודשים קודמים) למעלה, ואחריו
 * החודש הנוכחי. צ'ק מיולי שלא סומן חייב להמשיך להופיע בספטמבר, אחרת
 * הוא נעלם עם גלגול החודש — וזה בדיוק הכסף שהמערכת אמורה לשמור.
 */
export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const principal = await requirePrincipal();
  const { m } = await searchParams;

  const anchor = m ? new Date(`${m}-01T00:00:00Z`) : new Date();
  const window = monthWindow(anchor);
  const canMark = can(principal.role, 'checks.mark');

  const [monthChecks, overdue] = await Promise.all([
    asPrincipal(principal, (tx) => checksForMonth(tx, window.from, window.to)),
    asPrincipal(principal, (tx) => overdueChecks(tx, window.from)),
  ]);

  const summary = reconcile(monthChecks);

  async function mark(id: string, formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'checks.mark')) throw new Error('אין הרשאה לסמן צ׳קים');

    const status = String(formData.get('status')) as 'cleared' | 'partial' | 'bounced' | 'pending';
    const clearedAmount = formData.get('clearedAmount');

    await asPrincipal(principal, async (tx) => {
      await markCheck(tx, id, {
        status,
        clearedAmount: clearedAmount ? String(clearedAmount) : null,
      });
      // כל סימון נכתב לזרם — כך שיש תשובה ל"מי בדק את זה ומתי"
      if (status !== 'pending') {
        await publishEvent(tx, {
          type: status === 'cleared' ? 'checks.cleared'
              : status === 'partial' ? 'checks.partial' : 'checks.bounced',
          actorType: 'user',
          actorId: principal.userId,
          subjectType: 'check',
          subjectId: id,
          payload: clearedAmount ? { amount: String(clearedAmount) } : {},
        });
      }
    });
    revalidatePath('/checks');
  }

  const prev = monthWindow(shiftMonth(anchor, -1));
  const next = monthWindow(shiftMonth(anchor, 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem]">צ׳קים לפירעון</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            {attentionLine(summary.counts.overdue + summary.counts.due_today + overdue.length, summary.counts.upcoming)}
          </p>
        </div>

        <nav className="flex items-center gap-1 rounded-md border border-hairline p-1">
          <Link href={`/checks?m=${prev.from.slice(0, 7)}`} className="rounded-sm px-2.5 py-1.5 text-[0.85rem] hover:bg-sunken">→</Link>
          <span className="min-w-32 px-2 text-center text-[0.88rem] font-medium">{window.label}</span>
          <Link href={`/checks?m=${next.from.slice(0, 7)}`} className="rounded-sm px-2.5 py-1.5 text-[0.85rem] hover:bg-sunken">←</Link>
        </nav>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <Tile label="צפוי החודש" value={formatILS(summary.expected)} />
        <Tile label="נכנס בפועל" value={formatILS(summary.received)} tone={summary.received > 0 ? 'positive' : undefined} />
        <Tile
          label="חסר מפירעון חלקי"
          value={formatILS(summary.shortfall)}
          tone={summary.shortfall > 0 ? 'warning' : undefined}
          note={summary.shortfall > 0 ? 'יתרה פתוחה' : undefined}
        />
        <Tile
          label="חזר"
          value={formatILS(summary.bounced)}
          tone={summary.bounced > 0 ? 'danger' : undefined}
          note={summary.counts.bounced > 0 ? `${summary.counts.bounced} צ׳קים` : undefined}
        />
      </div>

      {overdue.length > 0 ? (
        <section className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--danger)' }}>
          <header className="flex items-baseline justify-between px-4 py-3" style={{ background: 'var(--danger-quiet)' }}>
            <h2 className="text-[0.98rem]" style={{ color: 'var(--danger)' }}>
              נגרר מחודשים קודמים
            </h2>
            <span className="tnum text-[0.8rem]" style={{ color: 'var(--danger)' }}>
              {formatILS(overdue.reduce((s, c) => s + toAgorot(c.amount), 0))} ₪ פתוחים
            </span>
          </header>
          <ul className="divide-y divide-hairline">
            {overdue.map((c) => (
              <CheckRowItem key={c.id} check={c} status="overdue" canMark={canMark} onMark={mark} />
            ))}
          </ul>
        </section>
      ) : null}

      {monthChecks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">אין צ׳קים ב{window.label}</h2>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="flex items-baseline justify-between border-b border-hairline bg-sunken px-4 py-2.5">
            <h2 className="text-[0.85rem]">{window.label}</h2>
            <span className="text-[0.76rem] text-muted">
              {summary.counts.cleared + summary.counts.partial} מתוך {monthChecks.length} אומתו
            </span>
          </header>
          <ul className="divide-y divide-hairline">
            {monthChecks.map((c) => (
              <CheckRowItem key={c.id} check={c} status={displayStatus(c)} canMark={canMark} onMark={mark} />
            ))}
          </ul>
        </section>
      )}

      {!canMark ? (
        <p className="text-[0.82rem] text-muted">
          אין לך הרשאה לסמן צ׳קים. אפשר לצפות בלבד.
        </p>
      ) : null}
    </div>
  );
}

/** "5 עוד לא אומתו" ליד "0 מתוך 34" מבלבל — ההפרדה בין מה שהגיע
 *  לבין מה שעוד לא הגיע היא מה שהופך את המספר לשימושי. */
function attentionLine(due: number, upcoming: number): string {
  if (due === 0 && upcoming === 0) return 'אין צ׳קים לתקופה הזו';
  if (due === 0) return `הכול אומת · ${upcoming} עוד לא הגיעו למועד`;
  const head = due === 1 ? 'צ׳ק אחד דורש בדיקה מול הבנק' : `${due} צ׳קים דורשים בדיקה מול הבנק`;
  return upcoming > 0 ? `${head} · ${upcoming} עוד לא הגיעו למועד` : head;
}

function Tile({
  label, value, note, tone,
}: {
  label: string; value: string; note?: string; tone?: 'positive' | 'warning' | 'danger';
}) {
  const color = tone ? `var(--${tone})` : undefined;
  return (
    <div className="px-4 py-3.5">
      <div className="text-[0.72rem] text-muted">{label}</div>
      <div className="mt-1 text-[1.5rem] font-semibold leading-none" style={color ? { color } : undefined}>
        {value} <span className="text-[0.9rem] font-normal text-muted">₪</span>
      </div>
      {note ? <div className="mt-1.5 text-[0.72rem]" style={color ? { color } : undefined}>{note}</div> : null}
    </div>
  );
}
