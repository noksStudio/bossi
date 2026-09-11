import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asPrincipal, deleteTemplate, listTemplates, TEMPLATE_CHANNELS } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'תבניות הודעה' };

export default async function TemplatesPage() {
  const principal = await requirePrincipal();
  const templates = await asPrincipal(principal, (tx) => listTemplates(tx));

  async function remove(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    await asPrincipal(principal, (tx) => deleteTemplate(tx, String(formData.get('id'))));
    redirect('/leads/templates');
  }

  return (
    <div className="space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/leads" className="hover:text-primary">לידים</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>תבניות הודעה</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem]">תבניות הודעה</h1>
          <p className="mt-1 text-[0.88rem] text-muted">
            טקסט שמור לפנייה — לא נשלח אוטומטית. משתמשים ב-<code dir="ltr">{'{{contact_name}}'}</code> ו-<code dir="ltr">{'{{business_name}}'}</code> כדי שהעתקה מעמוד הליד תמלא אותם.
          </p>
        </div>
        <Link
          href="/leads/templates/new"
          className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          תבנית חדשה
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">עוד אין תבניות</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-secondary">
            הוסיפו תבנית לפנייה קרה או חמה — היא תהיה זמינה לבחירה מעמוד כל ליד.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/leads/templates/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-[0.72rem] text-muted">
                    {TEMPLATE_CHANNELS[t.channel]}
                  </span>
                </div>
                <p className="mt-1 truncate text-[0.82rem] text-secondary">{t.body}</p>
              </div>
              <form action={remove}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="shrink-0 text-[0.8rem] hover:underline" style={{ color: 'var(--danger)' }}>
                  מחק
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
