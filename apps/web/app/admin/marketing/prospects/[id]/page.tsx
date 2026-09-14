import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  addProspectNote, deleteProspect, getProspect, listProspectNotes,
  setProspectBooked, setProspectContacted, setProspectFollowUp,
} from '@bossi/db';
import { requireAdmin } from '@/lib/platform-session';
import { StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'פרוספקט · שיווק' };

const SOURCE_LABELS: Record<string, string> = {
  google_places: 'Google Places',
  referral: 'הפניה',
  facebook_group: 'קבוצת פייסבוק',
  cold_call: 'פנייה יזומה',
  other: 'אחר',
};

/**
 * כרטיס עבודה על פרוספקט בודד — לא עוד עמודות ברשימה. פה נכתב מה
 * קרה בשיחה בפועל ונקבע מתי לחזור, כי "נוצר קשר" (0018) ו"נקבעה שיחה"
 * (0019) הם שני דגלים, לא תיעוד. ראה ADR (0020): הערות בטבלה נפרדת
 * כדי ששיחה שנייה לא תדרוס את התקציר של הראשונה.
 */
export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const prospect = await getProspect(id);
  if (!prospect) notFound();
  const notes = await listProspectNotes(id);

  async function toggleContacted(formData: FormData) {
    'use server';
    await requireAdmin();
    await setProspectContacted(id, formData.get('contacted') === '1');
    redirect(`/admin/marketing/prospects/${id}`);
  }

  async function toggleBooked(formData: FormData) {
    'use server';
    await requireAdmin();
    await setProspectBooked(id, formData.get('booked') === '1');
    redirect(`/admin/marketing/prospects/${id}`);
  }

  async function saveFollowUp(formData: FormData) {
    'use server';
    await requireAdmin();
    const date = String(formData.get('followUp') ?? '').trim();
    await setProspectFollowUp(id, date || null);
    redirect(`/admin/marketing/prospects/${id}`);
  }

  async function addNote(formData: FormData) {
    'use server';
    await requireAdmin();
    const body = String(formData.get('body') ?? '').trim();
    if (!body) return;
    await addProspectNote(id, body);
    redirect(`/admin/marketing/prospects/${id}`);
  }

  async function removeProspect() {
    'use server';
    await requireAdmin();
    await deleteProspect(id);
    redirect('/admin/marketing?tab=paid');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/admin/marketing?tab=paid" className="hover:text-primary">שיווק</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>{prospect.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem]">{prospect.name}</h1>
          <p className="mt-1 text-[0.82rem] text-muted">{SOURCE_LABELS[prospect.source] ?? prospect.source}</p>
        </div>
        <div className="flex items-center gap-2">
          {prospect.booked_at ? <StatusPill tone="positive">שיחה נקבעה</StatusPill>
            : prospect.contacted ? <StatusPill tone="neutral">נוצר קשר</StatusPill>
              : <StatusPill tone="warning">טרם נוצר קשר</StatusPill>}
        </div>
      </div>

      <section className="space-y-1 rounded-lg border border-hairline p-4 text-[0.88rem]">
        {prospect.phone ? <div dir="ltr" className="text-secondary">{prospect.phone}</div> : null}
        {prospect.address ? <div className="text-secondary">{prospect.address}</div> : null}
        {prospect.website ? <div dir="ltr" className="text-secondary">{prospect.website}</div> : null}
        {prospect.note ? <div className="mt-2 text-secondary">{prospect.note}</div> : null}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <form action={toggleContacted}>
          <input type="hidden" name="contacted" value={prospect.contacted ? '0' : '1'} />
          <button type="submit" className="rounded-md border border-strong px-3.5 py-2 text-[0.85rem]" style={{ color: prospect.contacted ? 'var(--positive)' : undefined }}>
            {prospect.contacted ? '✓ נוצר קשר' : 'סמן שנוצר קשר'}
          </button>
        </form>
        <form action={toggleBooked}>
          <input type="hidden" name="booked" value={prospect.booked_at ? '0' : '1'} />
          <button type="submit" className="rounded-md border border-strong px-3.5 py-2 text-[0.85rem] font-medium" style={{ color: prospect.booked_at ? 'var(--positive)' : 'var(--accent)' }}>
            {prospect.booked_at ? '✓ שיחה נקבעה' : 'קבע שיחה'}
          </button>
        </form>
        <form action={removeProspect}>
          <button type="submit" className="rounded-md px-3.5 py-2 text-[0.85rem]" style={{ color: 'var(--danger)' }}>הסרה</button>
        </form>
      </section>

      <section className="rounded-lg border border-hairline p-4">
        <h2 className="text-[0.95rem]">פולואפ</h2>
        <form action={saveFollowUp} className="mt-2 flex flex-wrap items-center gap-2.5">
          <input
            type="date" name="followUp" defaultValue={prospect.next_follow_up_at ?? ''}
            className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.88rem] outline-none"
          />
          <button type="submit" className="rounded-md border border-strong px-3.5 py-2 text-[0.85rem]">שמירה</button>
          {prospect.next_follow_up_at ? (
            <span className="text-[0.8rem] text-muted">נקבע ל־{formatDate(prospect.next_follow_up_at)}</span>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-[0.95rem]">מה היה בשיחה</h2>
        <form action={addNote} className="flex flex-col gap-2.5">
          <textarea
            name="body" rows={3} placeholder="תקציר קצר של השיחה — מה נאמר, מה הכאב שהם ציינו, מה הבא"
            className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.88rem] outline-none"
          />
          <button type="submit" className="self-start rounded-md px-4 py-2 text-[0.85rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
            הוספת רשומה
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="text-[0.85rem] text-muted">עוד אין תיעוד שיחות.</p>
        ) : (
          <ul className="space-y-2.5">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-hairline p-3.5 text-[0.86rem]">
                <div className="text-[0.72rem] text-muted">{formatDateTime(n.created_at)}</div>
                <div className="mt-1 whitespace-pre-wrap text-secondary">{n.body}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL');
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}
