import { redirect } from 'next/navigation';
import Link from 'next/link';
import { asPrincipal, createLead, LEAD_SOURCES, publishEvent } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ליד חדש' };

export default async function NewLeadPage() {
  const principal = await requirePrincipal();

  async function create(formData: FormData) {
    'use server';
    const displayName = String(formData.get('displayName') ?? '').trim();
    if (!displayName) redirect('/leads/new?error=1');

    await asPrincipal(principal, async (tx) => {
      const leadId = await createLead(tx, {
        displayName,
        source: str(formData.get('source')),
        contactName: str(formData.get('contactName')),
        contactEmail: str(formData.get('contactEmail')),
        contactPhone: str(formData.get('contactPhone')),
      });
      await publishEvent(tx, {
        type: 'leads.created',
        actorType: 'user',
        actorId: principal.userId,
        subjectType: 'lead',
        subjectId: leadId,
        payload: { displayName, source: str(formData.get('source')) },
      });
    });

    redirect('/leads');
  }

  return (
    <div className="max-w-xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/leads" className="hover:text-primary">לידים</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>חדש</span>
      </nav>

      <h1 className="text-[1.6rem]">ליד חדש</h1>

      <form action={create} className="space-y-4">
        <Field name="displayName" label="שם העסק / הליד" required placeholder="עסק פוטנציאלי בע״מ" />

        <div>
          <label htmlFor="source" className="block text-[0.85rem] font-medium">מקור</label>
          <select
            id="source"
            name="source"
            defaultValue=""
            className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          >
            <option value="">לא ידוע</option>
            {Object.entries(LEAD_SOURCES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <Field name="contactName" label="איש קשר" placeholder="שם" />
        <Field name="contactEmail" label="אימייל" type="email" dir="ltr" />
        <Field name="contactPhone" label="טלפון" dir="ltr" placeholder="050-1234567" />

        <div className="flex gap-2.5 pt-2">
          <button
            type="submit"
            className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            צור ליד
          </button>
          <Link href="/leads" className="rounded-md border border-strong px-4 py-2.5 text-[0.9rem]">
            ביטול
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  name, label, hint, ...input
}: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-[0.85rem] font-medium">{label}</label>
      {hint ? <p className="mt-0.5 text-[0.75rem] text-muted">{hint}</p> : null}
      <input
        id={name}
        name={name}
        {...input}
        className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
      />
    </div>
  );
}

function str(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? '').trim();
  return s.length > 0 ? s : null;
}
