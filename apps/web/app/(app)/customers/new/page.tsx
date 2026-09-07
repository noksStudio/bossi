import { redirect } from 'next/navigation';
import Link from 'next/link';
import { asPrincipal, createCustomer, publishEvent } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לקוח חדש' };

export default async function NewCustomerPage() {
  const principal = await requirePrincipal();

  async function create(formData: FormData) {
    'use server';
    const displayName = String(formData.get('displayName') ?? '').trim();
    if (!displayName) redirect('/customers/new?error=1');

    const terms = Number(formData.get('paymentTermsDays'));

    const id = await asPrincipal(principal, async (tx) => {
      const customerId = await createCustomer(tx, {
        displayName,
        legalName: str(formData.get('legalName')),
        businessId: str(formData.get('businessId')),
        paymentTermsDays: Number.isFinite(terms) && terms >= 0 ? terms : 30,
        tags: String(formData.get('tags') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });

      // כל דבר שקורה נכתב לזרם. ציר הזמן נבנה ממנו, לא מעמודה נפרדת.
      await publishEvent(tx, {
        type: 'kernel.customer_created',
        actorType: 'user',
        actorId: principal.userId,
        customerId,
        payload: { name: displayName },
      });
      return customerId;
    });

    redirect(`/customers/${id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/customers" className="hover:text-primary">
          לקוחות
        </Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>חדש</span>
      </nav>

      <h1 className="text-[1.6rem]">לקוח חדש</h1>

      <form action={create} className="space-y-4">
        <Field name="displayName" label="שם התצוגה" required placeholder="דני כהן — סטודיו" />
        <Field name="legalName" label="שם משפטי" placeholder="ד. כהן עיצוב בע״מ" />
        <Field name="businessId" label="ח״פ / ע״מ" dir="ltr" placeholder="515993027" />
        <Field
          name="paymentTermsDays"
          label="תנאי תשלום (ימים)"
          type="number"
          defaultValue="30"
          dir="ltr"
        />
        <Field name="tags" label="תגיות" placeholder="ריטיינר, לקוח קבוע" hint="מופרדות בפסיק" />

        <div className="flex gap-2.5 pt-2">
          <button
            type="submit"
            className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            צור לקוח
          </button>
          <Link
            href="/customers"
            className="rounded-md border border-strong px-4 py-2.5 text-[0.9rem]"
          >
            ביטול
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  ...input
}: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-[0.85rem] font-medium">
        {label}
      </label>
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
