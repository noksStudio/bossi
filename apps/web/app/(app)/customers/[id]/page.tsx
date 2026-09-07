import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  asPrincipal, createNote, customerTimeline, deleteNote, getCustomerDetail, listDocuments, listNotes, publishEvent,
} from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { loadShell, moduleName, moduleOf } from '@/lib/navigation';
import { StatusPill } from '@/components/site/chrome';
import { Timeline } from '@/components/app/timeline';
import { ContactList } from '@/components/app/contacts';
import { DocumentRowItem } from '@/components/app/document-row';
import { NotesPanel } from '@/components/app/notes-panel';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; tone: 'positive' | 'warning' | 'neutral' }> = {
  active: { label: 'פעיל', tone: 'positive' },
  prospect: { label: 'ליד', tone: 'warning' },
  dormant: { label: 'רדום', tone: 'neutral' },
  archived: { label: 'בארכיון', tone: 'neutral' },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const customer = await asPrincipal(principal, (tx) => getCustomerDetail(tx, id));
  return { title: customer?.display_name ?? 'לקוח' };
}

/**
 * כרטיס הלקוח — המסך שכל השאר נתלה עליו.
 *
 * הלשוניות והכרטיסים בעמודה הצדדית מגיעים מ-slots של המודולים הפעילים.
 * המסך הזה לא יודע מה זה ריטיינר או הזמנה, ולכן הוא לא צריך להשתנות
 * כשמודול נוסף או נכבה.
 */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const [detail, shell] = await Promise.all([
    asPrincipal(principal, (tx) => getCustomerDetail(tx, id)),
    loadShell(principal),
  ]);
  if (!detail) notFound();

  const [events, documents, notes] = await Promise.all([
    asPrincipal(principal, (tx) => customerTimeline(tx, id, { limit: 40 })),
    asPrincipal(principal, (tx) => listDocuments(tx, { customerId: id, limit: 12 })),
    asPrincipal(principal, (tx) => listNotes(tx, { customerId: id })),
  ]);

  async function addNote(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    const body = String(formData.get('body') ?? '').trim();
    if (!body) return;
    await asPrincipal(principal, async (tx) => {
      await createNote(tx, { body, customerId: id, pinned: formData.get('pinned') === '1' });
      await publishEvent(tx, {
        type: 'kernel.note_added', actorType: 'user', actorId: principal.userId, customerId: id, payload: {},
      });
    });
    revalidatePath(`/customers/${id}`);
  }

  async function removeNote(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    // אין בדיקת תפקיד כאן בכוונה: המדיניות במסד היא זו שעוצרת,
    // ולכן גם קריאה שעוקפת את הממשק תיכשל.
    await asPrincipal(principal, (tx) => deleteNote(tx, String(formData.get('id'))));
    revalidatePath(`/customers/${id}`);
  }
  const tabs = shell.slots('customer.tabs');
  const cards = shell.slots('customer.overview.cards');
  const status = STATUS[detail.status] ?? { label: detail.status, tone: 'neutral' as const };

  return (
    <div className="space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/customers" className="hover:text-primary">
          לקוחות
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        <span>{detail.display_name}</span>
      </nav>

      <header className="flex flex-wrap items-start gap-4">
        <div
          className="grid size-12 shrink-0 place-items-center rounded-md text-[0.95rem] font-semibold"
          style={{ background: 'var(--accent-quiet)', color: 'var(--accent)' }}
        >
          {initials(detail.display_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.5rem]">{detail.display_name}</h1>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2.5 text-[0.82rem] text-muted">
            {detail.legal_name ? <span>{detail.legal_name}</span> : null}
            {detail.business_id ? <span dir="ltr">ח״פ {detail.business_id}</span> : null}
            <span>שוטף + {detail.payment_terms_days}</span>
            {detail.credit_limit ? (
              <span>מסגרת {Number(detail.credit_limit).toLocaleString('he-IL')} ₪</span>
            ) : null}
          </p>
        </div>
      </header>

      {/* לשוניות שמודולים תרמו. הלשונית הראשונה תמיד קיימת — היא של הקרנל. */}
      <div className="flex flex-wrap gap-1 border-b border-hairline">
        <span
          className="border-b-2 px-3 pb-2 text-[0.88rem] font-medium"
          style={{ borderColor: 'var(--accent)' }}
        >
          סקירה
        </span>
        {tabs.map((tab) => (
          <span
            key={tab.id}
            className="cursor-not-allowed px-3 pb-2 text-[0.88rem] text-muted"
            title={`${moduleName(moduleOf(tab.id))} — נבנה בספרינט הקרוב`}
          >
            {tab.label ?? tab.id}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-hairline">
            <header className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
              <h2 className="text-[1rem]">מסמכים</h2>
              <Link href={`/documents?q=`} className="text-[0.78rem] text-muted hover:text-primary">
                כל המסמכים
              </Link>
            </header>
            {documents.length === 0 ? (
              <p className="px-4 py-6 text-[0.88rem] text-muted">אין עדיין מסמכים ללקוח הזה.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {documents.map((d) => (
                  <DocumentRowItem key={d.id} doc={d} showCustomer={false} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-1 text-[1.02rem]">ציר הזמן</h2>
            <p className="mb-4 text-[0.8rem] text-muted">{countLabel(detail.event_count)}</p>
            <Timeline events={events} catalog={shell.eventCatalog} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-hairline p-4">
            <h2 className="mb-1 text-[0.95rem]">אנשי קשר</h2>
            <ContactList contacts={detail.contacts} />
          </section>

          <NotesPanel notes={notes} role={principal.role} onAdd={addNote} onDelete={removeNote} />

          {detail.tags.length > 0 ? (
            <section className="rounded-lg border border-hairline p-4">
              <h2 className="mb-2.5 text-[0.95rem]">תגיות</h2>
              <ul className="flex flex-wrap gap-1.5">
                {detail.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-hairline px-2.5 py-1 text-[0.78rem] text-secondary"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {detail.notes ? (
            <section className="rounded-lg border border-hairline p-4">
              <h2 className="mb-2 text-[0.95rem]">הערות</h2>
              <p className="whitespace-pre-wrap text-[0.88rem] leading-relaxed text-secondary">
                {detail.notes}
              </p>
            </section>
          ) : null}

          {/* מקומות ששמורים על ידי מודולים פעילים ועוד לא מולאו */}
          {cards.map((card) => (
            <section key={card.id} className="rounded-lg border border-dashed border-hairline p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[0.95rem]">{card.label ?? card.id}</h2>
                <span className="shrink-0 text-[0.7rem] text-muted">
                  {moduleName(moduleOf(card.id))}
                </span>
              </div>
              <p className="mt-1.5 text-[0.8rem] text-muted">המקום שמור. נבנה בספרינט הקרוב.</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** עברית לא סופרת כמו אנגלית: "1 אירועים" נשמע שבור. */
function countLabel(n: number): string {
  if (n === 0) return 'עוד לא קרה כלום';
  if (n === 1) return 'אירוע אחד · הכל מאותו מקום';
  if (n === 2) return 'שני אירועים · הכל מאותו מקום';
  return `${n} אירועים · הכל מאותו מקום`;
}

function initials(name: string): string {
  return name
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}
