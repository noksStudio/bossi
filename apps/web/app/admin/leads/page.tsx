import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createProspect, deleteProspect, listProspects, searchProspects,
  setProspectBooked, setProspectContacted,
} from '@bossi/db';
import { requireAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לידים · ניהול' };

const PROSPECT_SOURCE_LABELS: Record<string, string> = {
  google_places: 'Google Places',
  referral: 'הפניה',
  facebook_group: 'קבוצת פייסבוק',
  cold_call: 'פנייה יזומה',
  other: 'אחר',
};

/**
 * תיקיית הלידים — כל דייר פוטנציאלי ל-Bossi, מכל מקור, במקום אחד
 * עם חיפוש. נפרד מ-`/admin/marketing` בכוונה: שיווק הן הפעילויות
 * שמביאות לידים, זו רשימת העבודה עצמה. ראה ADR-026.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const trimmed = q?.trim();
  const prospects = trimmed ? await searchProspects(trimmed) : await listProspects();

  async function toggleContacted(formData: FormData) {
    'use server';
    await requireAdmin();
    await setProspectContacted(String(formData.get('id')), formData.get('contacted') === '1');
    redirect('/admin/leads');
  }

  async function toggleBooked(formData: FormData) {
    'use server';
    await requireAdmin();
    await setProspectBooked(String(formData.get('id')), formData.get('booked') === '1');
    redirect('/admin/leads');
  }

  async function addProspectManually(formData: FormData) {
    'use server';
    await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    await createProspect({
      name,
      phone: String(formData.get('phone') ?? '').trim() || null,
      source: String(formData.get('source') ?? 'other'),
      note: String(formData.get('note') ?? '').trim() || null,
      nationalId: String(formData.get('nationalId') ?? '').trim() || null,
      companyNumber: String(formData.get('companyNumber') ?? '').trim() || null,
    });
    redirect('/admin/leads');
  }

  async function removeProspect(formData: FormData) {
    'use server';
    await requireAdmin();
    await deleteProspect(String(formData.get('id')));
    redirect('/admin/leads');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.6rem]">לידים</h1>
          <p className="mt-1 text-[0.88rem] text-muted">כל דייר פוטנציאלי ל-Bossi, מכל מקור.</p>
        </div>
        <Link href="/admin/marketing?tab=paid" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">חיפוש ב-Google Places ←</Link>
      </div>

      <form className="flex flex-wrap gap-2.5">
        <input
          name="q" defaultValue={q ?? ''} placeholder="חיפוש לפי שם, טלפון, ת&quot;ז או ח&quot;פ"
          className="min-w-64 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
        />
        <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">חיפוש</button>
        {trimmed ? <Link href="/admin/leads" className="rounded-md px-4 py-2 text-[0.88rem] text-muted hover:underline">איפוס</Link> : null}
      </form>

      <form action={addProspectManually} className="grid gap-2.5 rounded-lg border border-hairline p-4 sm:grid-cols-2">
        <input name="name" placeholder="שם העסק / איש קשר" required className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
        <input name="phone" placeholder="טלפון" dir="ltr" className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
        <input name="nationalId" placeholder='ת"ז (רשות)' dir="ltr" className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
        <input name="companyNumber" placeholder='ח"פ (רשות)' dir="ltr" className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
        <select name="source" defaultValue="referral" className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none">
          {Object.entries(PROSPECT_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input name="note" placeholder="הערה (רשות)" className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
        <button type="submit" className="justify-self-start rounded-md px-4 py-2 text-[0.88rem] font-medium text-white sm:col-span-2" style={{ background: 'var(--accent)' }}>
          הוספת ליד ידנית
        </button>
      </form>

      {prospects.length === 0 ? (
        <p className="text-[0.88rem] text-muted">{trimmed ? 'לא נמצא ליד תואם.' : 'עוד אין לידים שמורים.'}</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
          {prospects.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <Link href={`/admin/leads/${p.id}`} className="text-[0.9rem] font-medium hover:underline">{p.name}</Link>
                <div className="text-[0.72rem] text-muted">{PROSPECT_SOURCE_LABELS[p.source] ?? p.source}</div>
                {p.address ? <div className="text-[0.78rem] text-muted">{p.address}</div> : null}
                {p.phone ? <div className="text-[0.78rem] text-muted" dir="ltr">{p.phone}</div> : null}
                {p.national_id ? <div className="text-[0.78rem] text-muted" dir="ltr">ת&quot;ז {p.national_id}</div> : null}
                {p.company_number ? <div className="text-[0.78rem] text-muted" dir="ltr">ח&quot;פ {p.company_number}</div> : null}
                {p.next_follow_up_at ? (
                  <div className="mt-1 text-[0.76rem] font-medium" style={{ color: new Date(p.next_follow_up_at) < new Date() ? 'var(--danger)' : 'var(--accent)' }}>
                    פולואפ: {new Date(p.next_follow_up_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                <form action={toggleContacted}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="contacted" value={p.contacted ? '0' : '1'} />
                  <button type="submit" className="text-[0.8rem] hover:underline" style={{ color: p.contacted ? 'var(--positive)' : 'var(--text-muted)' }}>
                    {p.contacted ? '✓ נוצר קשר' : 'סמן שנוצר קשר'}
                  </button>
                </form>
                <form action={toggleBooked}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="booked" value={p.booked_at ? '0' : '1'} />
                  <button type="submit" className="text-[0.8rem] font-medium hover:underline" style={{ color: p.booked_at ? 'var(--positive)' : 'var(--accent)' }}>
                    {p.booked_at ? '✓ שיחה נקבעה' : 'קבע שיחה'}
                  </button>
                </form>
                <form action={removeProspect}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-[0.8rem] hover:underline" style={{ color: 'var(--danger)' }}>הסרה</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
