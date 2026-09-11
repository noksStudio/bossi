import { redirect } from 'next/navigation';
import Link from 'next/link';
import { asPrincipal, createTemplate, TEMPLATE_CHANNELS, type TemplateChannel } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'תבנית חדשה' };

export default async function NewTemplatePage() {
  await requirePrincipal();

  async function create(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    const name = String(formData.get('name') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();
    if (!name || !body) redirect('/leads/templates/new?error=1');

    await asPrincipal(principal, (tx) =>
      createTemplate(tx, { name, channel: String(formData.get('channel')) as TemplateChannel, body }),
    );
    redirect('/leads/templates');
  }

  return (
    <div className="max-w-xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/leads/templates" className="hover:text-primary">תבניות הודעה</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>חדשה</span>
      </nav>

      <h1 className="text-[1.6rem]">תבנית חדשה</h1>

      <form action={create} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-[0.85rem] font-medium">שם התבנית</label>
          <input
            id="name"
            name="name"
            required
            placeholder="פנייה קרה — ראשונית"
            className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
        </div>

        <div>
          <label htmlFor="channel" className="block text-[0.85rem] font-medium">ערוץ</label>
          <select
            id="channel"
            name="channel"
            defaultValue="whatsapp"
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
            אפשר להשתמש ב-<code dir="ltr">{'{{contact_name}}'}</code> ו-<code dir="ltr">{'{{business_name}}'}</code> — ימולאו אוטומטית בעת ההעתקה מעמוד הליד.
          </p>
          <textarea
            id="body"
            name="body"
            required
            rows={6}
            placeholder={'היי {{contact_name}},\nפניתי אליך כי...'}
            className="mt-1.5 w-full resize-y rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="submit"
            className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            שמור תבנית
          </button>
          <Link href="/leads/templates" className="rounded-md border border-strong px-4 py-2.5 text-[0.9rem]">
            ביטול
          </Link>
        </div>
      </form>
    </div>
  );
}
