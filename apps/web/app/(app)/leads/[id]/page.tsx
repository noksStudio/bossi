import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  asPrincipal, convertLead, createNote, deleteLead, deleteNote, getLead, LEAD_SOURCES, LEAD_STAGES,
  listNotes, listTemplates, publishEvent, setLeadStage, type LeadStage,
} from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { StatusPill } from '@/components/site/chrome';
import { NotesPanel } from '@/components/app/notes-panel';
import { LeadStageForm } from '@/components/app/lead-stage-form';
import { LeadTemplatePicker } from '@/components/app/lead-template-picker';

export const dynamic = 'force-dynamic';

const STAGE_TONE: Record<string, 'positive' | 'warning' | 'neutral'> = {
  new: 'neutral',
  contacted: 'neutral',
  qualified: 'warning',
  proposal: 'warning',
  won: 'positive',
  lost: 'neutral',
};

// כל השלבים חוץ מ-won — אליו מגיעים רק דרך "המר ללקוח" (convertLead),
// לא דרך שינוי שלב חופשי. ראו lead-stage-form.tsx.
const STAGE_OPTIONS = Object.entries(LEAD_STAGES)
  .filter(([value]) => value !== 'won')
  .map(([value, label]) => ({ value, label }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const lead = await asPrincipal(principal, (tx) => getLead(tx, id));
  return { title: lead?.display_name ?? 'ליד' };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const [lead, notes, templates] = await Promise.all([
    asPrincipal(principal, (tx) => getLead(tx, id)),
    asPrincipal(principal, (tx) => listNotes(tx, { subjectType: 'lead', subjectId: id })),
    asPrincipal(principal, (tx) => listTemplates(tx)),
  ]);
  if (!lead) notFound();

  const isClosed = lead.stage === 'won' || lead.stage === 'lost';

  async function changeStage(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    const stage = String(formData.get('stage') ?? '') as Exclude<LeadStage, 'won'>;
    const lostReason = String(formData.get('lostReason') ?? '').trim() || null;

    await asPrincipal(principal, async (tx) => {
      await setLeadStage(tx, id, stage, lostReason);
      await publishEvent(tx, {
        type: 'leads.stage_changed',
        actorType: 'user',
        actorId: principal.userId,
        subjectType: 'lead',
        subjectId: id,
        payload: { stage, lostReason },
      });
    });
    revalidatePath(`/leads/${id}`);
  }

  async function convert() {
    'use server';
    const principal = await requirePrincipal();
    const result = await asPrincipal(principal, async (tx) => {
      const r = await convertLead(tx, id);
      if (r) {
        await publishEvent(tx, {
          type: 'leads.converted',
          actorType: 'user',
          actorId: principal.userId,
          customerId: r.customerId,
          subjectType: 'lead',
          subjectId: id,
          payload: { customerId: r.customerId },
        });
      }
      return r;
    });
    if (result) redirect(`/customers/${result.customerId}`);
  }

  async function remove() {
    'use server';
    const principal = await requirePrincipal();
    await asPrincipal(principal, (tx) => deleteLead(tx, id));
    redirect('/leads');
  }

  async function addNote(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    const body = String(formData.get('body') ?? '').trim();
    if (!body) return;
    await asPrincipal(principal, (tx) =>
      createNote(tx, { body, subjectType: 'lead', subjectId: id, pinned: formData.get('pinned') === '1' }),
    );
    revalidatePath(`/leads/${id}`);
  }

  async function removeNote(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    await asPrincipal(principal, (tx) => deleteNote(tx, String(formData.get('id'))));
    revalidatePath(`/leads/${id}`);
  }

  return (
    <div className="space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/leads" className="hover:text-primary">לידים</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>{lead.display_name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.5rem]">{lead.display_name}</h1>
            <StatusPill tone={STAGE_TONE[lead.stage] ?? 'neutral'}>{LEAD_STAGES[lead.stage]}</StatusPill>
          </div>
          {lead.converted_customer_name ? (
            <p className="mt-1 text-[0.85rem] text-secondary">
              הפך ללקוח:{' '}
              <Link href={`/customers/${lead.converted_customer_id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                {lead.converted_customer_name}
              </Link>
            </p>
          ) : null}
          {lead.stage === 'lost' && lead.lost_reason ? (
            <p className="mt-1 text-[0.82rem] text-muted">סיבה: {lead.lost_reason}</p>
          ) : null}
        </div>
        {!isClosed ? (
          <form action={convert}>
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              המר ללקוח
            </button>
          </form>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <NotesPanel notes={notes} role={principal.role} onAdd={addNote} onDelete={removeNote} />
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-hairline p-4">
            <h2 className="mb-2.5 text-[0.95rem]">פרטים</h2>
            <dl className="space-y-2 text-[0.86rem]">
              <Row label="מקור">{lead.source ? (LEAD_SOURCES[lead.source as keyof typeof LEAD_SOURCES] ?? lead.source) : '—'}</Row>
              {lead.referred_by_name ? (
                <Row label="מפנה">
                  <Link href={`/customers/${lead.referred_by_customer_id}`} className="hover:underline">
                    {lead.referred_by_name}
                  </Link>
                </Row>
              ) : null}
              {lead.contact_name ? <Row label="איש קשר">{lead.contact_name}</Row> : null}
              {lead.contact_email ? <Row label="אימייל"><span dir="ltr">{lead.contact_email}</span></Row> : null}
              {lead.contact_phone ? <Row label="טלפון"><span dir="ltr">{lead.contact_phone}</span></Row> : null}
            </dl>
          </section>

          <LeadTemplatePicker
            templates={templates.map((t) => ({ id: t.id, name: t.name, body: t.body }))}
            contactName={lead.contact_name}
            businessName={lead.display_name}
          />

          <section className="rounded-lg border border-hairline p-4">
            <h2 className="mb-2.5 text-[0.95rem]">שלב</h2>
            <LeadStageForm currentStage={lead.stage} options={STAGE_OPTIONS} onSubmit={changeStage} />
          </section>

          {!isClosed && principal.role === 'owner' ? (
            <form action={remove}>
              <button type="submit" className="text-[0.8rem] hover:underline" style={{ color: 'var(--danger)' }}>
                מחק ליד
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}
