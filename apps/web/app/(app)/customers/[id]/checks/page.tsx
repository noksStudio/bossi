import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { asPrincipal, checksForCustomer, getCustomerDetail, listNotes, markCheck, publishEvent } from '@bossi/db';
import { can, displayStatus, formatILS, reconcile } from '@bossi/core';
import { requirePrincipal } from '@/lib/session';
import { loadShell } from '@/lib/navigation';
import { customerTabs } from '@/lib/customer-tabs';
import { CustomerTabs } from '@/components/app/customer-tabs';
import { CheckRowItem } from '@/components/app/check-row';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const customer = await asPrincipal(principal, (tx) => getCustomerDetail(tx, id));
  return { title: `צ׳קים · ${customer?.display_name ?? 'לקוח'}` };
}

/**
 * היסטוריית התשלומים המלאה של שוכר אחד — כולל האפשרות לסמן מכאן.
 * מי שפתח את הכרטיס כדי לבדוק משהו לא צריך לחזור למסך החודשי כדי לתקן.
 */
export default async function CustomerChecksPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const [customer, shell] = await Promise.all([
    asPrincipal(principal, (tx) => getCustomerDetail(tx, id)),
    loadShell(principal),
  ]);
  if (!customer) notFound();

  const [checks, notes] = await Promise.all([
    asPrincipal(principal, (tx) => checksForCustomer(tx, id)),
    asPrincipal(principal, (tx) => listNotes(tx, { customerId: id, subjectType: 'check' })),
  ]);

  const summary = reconcile(checks);
  const canMark = can(principal.role, 'checks.mark');
  const notesByCheck = new Map<string, typeof notes>();
  for (const n of notes) {
    if (!n.subject_id) continue;
    notesByCheck.set(n.subject_id, [...(notesByCheck.get(n.subject_id) ?? []), n]);
  }

  async function mark(checkId: string, formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    if (!can(principal.role, 'checks.mark')) throw new Error('אין הרשאה לסמן צ׳קים');
    const status = String(formData.get('status')) as 'cleared' | 'partial' | 'bounced' | 'pending';
    const clearedAmount = formData.get('clearedAmount');

    await asPrincipal(principal, async (tx) => {
      await markCheck(tx, checkId, { status, clearedAmount: clearedAmount ? String(clearedAmount) : null });
      if (status !== 'pending') {
        await publishEvent(tx, {
          type: status === 'cleared' ? 'checks.cleared' : status === 'partial' ? 'checks.partial' : 'checks.bounced',
          actorType: 'user', actorId: principal.userId, customerId: id,
          subjectType: 'check', subjectId: checkId,
          payload: clearedAmount ? { amount: String(clearedAmount) } : {},
        });
      }
    });
    revalidatePath(`/customers/${id}/checks`);
  }

  return (
    <div className="space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/customers" className="hover:text-primary">לקוחות</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <Link href={`/customers/${id}`} className="hover:text-primary">{customer.display_name}</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>צ׳קים</span>
      </nav>

      <h1 className="text-[1.5rem]">{customer.display_name} · תשלומים</h1>

      <CustomerTabs tabs={customerTabs(shell.slots('customer.tabs'), id)} customerId={id} active="checks.tab" />

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <Tile label="שולם עד היום" value={formatILS(summary.received)} />
        <Tile label="פתוח" value={formatILS(summary.outstanding)} tone={summary.outstanding > 0 ? 'warning' : undefined} />
        <Tile label="חסר מפירעון חלקי" value={formatILS(summary.shortfall)} tone={summary.shortfall > 0 ? 'warning' : undefined} />
        <Tile label="חזר" value={formatILS(summary.bounced)} tone={summary.bounced > 0 ? 'danger' : undefined} />
      </div>

      {checks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">אין צ׳קים ללקוח הזה</h2>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline">
          <header className="flex items-baseline justify-between border-b border-hairline bg-sunken px-4 py-2.5">
            <h2 className="text-[0.85rem]">כל הצ׳קים</h2>
            <span className="text-[0.76rem] text-muted">
              {summary.counts.cleared + summary.counts.partial} מתוך {checks.length} אומתו
            </span>
          </header>
          <ul className="divide-y divide-hairline">
            {checks.map((c) => (
              <li key={c.id}>
                <ul><CheckRowItem check={c} status={displayStatus(c)} canMark={canMark} onMark={mark} /></ul>
                {(notesByCheck.get(c.id) ?? []).map((n) => (
                  <p key={n.id} className="mx-4 mb-2.5 rounded-md bg-sunken px-3 py-2 text-[0.8rem] leading-relaxed text-secondary">
                    {n.body}
                    <span className="ms-1.5 text-[0.7rem] text-muted">— {n.author_name ?? 'המערכת'}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) {
  const color = tone ? `var(--${tone})` : undefined;
  return (
    <div className="px-4 py-3.5">
      <div className="text-[0.72rem] text-muted">{label}</div>
      <div className="mt-1 text-[1.4rem] font-semibold leading-none" style={color ? { color } : undefined}>
        {value} <span className="text-[0.85rem] font-normal text-muted">₪</span>
      </div>
    </div>
  );
}
