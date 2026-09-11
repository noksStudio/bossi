import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { asPrincipal, deleteTemplate, getTemplate, TEMPLATE_CHANNELS, updateTemplate, type TemplateChannel } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const template = await asPrincipal(principal, (tx) => getTemplate(tx, id));
  return { title: template?.name ?? 'תבנית' };
}

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const template = await asPrincipal(principal, (tx) => getTemplate(tx, id));
  if (!template) notFound();

  async function save(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    const name = String(formData.get('name') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();
    if (!name || !body) redirect(`/leads/templates/${id}?error=1`);

    await asPrincipal(principal, (tx) =>
      updateTemplate(tx, id, { name, channel: String(formData.get('channel')) as TemplateChannel, body }),
    );
    redirect('/leads/templates');
  }

  async function remove() {
    'use server';
    const principal = await requirePrincipal();
    await asPrincipal(principal, (tx) => deleteTemplate(tx, id));
    redirect('/leads/templates');
  }

  return (
    <div className="max-w-xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/leads/templates" className="hover:text-primary">תבניות הודעה</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>{template.name}</span>
      </nav>

      <h1 className="text-[1.6rem]">עריכת תבנית</h1>

      <form action={save} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-[0.85rem] font-medium">שם התבנית</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={template.name}
            className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
        </div>

        <div>
          <label htmlFor="channel" className="block text-[0.85rem] font-medium">ערוץ</label>
          <select
            id="channel"
            name="channel"
            defaultValue={template.channel}
            className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          >
            {Object.entries(TEMPLATE_CHANNELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="body" className="block text-[0.85rem] font-medium">תוכן ההודעה</label>
          <p className="mt-0.5 text-[0.75rem] text-muted">
            <code dir="ltr">{'{{contact_name}}'}</code> ו-<code dir="ltr">{'{{business_name}}'}</code> ימולאו אוטומטית בהעתקה.
          </p>
          <textarea
            id="body"
            name="body"
            required
            rows={6}
            defaultValue={template.body}
            className="mt-1.5 w-full resize-y rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="submit"
            className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            שמור שינויים
          </button>
          <Link href="/leads/templates" className="rounded-md border border-strong px-4 py-2.5 text-[0.9rem]">
            ביטול
          </Link>
        </div>
      </form>

      <form action={remove} className="border-t border-hairline pt-4">
        <button type="submit" className="text-[0.8rem] hover:underline" style={{ color: 'var(--danger)' }}>
          מחק תבנית
        </button>
      </form>
    </div>
  );
}
