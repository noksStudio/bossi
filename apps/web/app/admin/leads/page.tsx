import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createProspect, getProspect, listProspects, searchProspects } from '@bossi/db';
import { parseLeadList } from '@/lib/lead-list';
import { LEAD_BATCHES, batchLeads } from '@/lib/lead-batches';
import { normalizePhone } from '@/lib/phone';
import { requireAdmin } from '@/lib/platform-session';
import { LeadList } from '@/components/admin/lead-quick-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לידים · ניהול' };

const PROSPECT_SOURCE_LABELS: Record<string, string> = {
  google_places: 'Google Places',
  landing: 'דף נחיתה',
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
  searchParams: Promise<{ q?: string; imported?: string; skipped?: string; dup?: string }>;
}) {
  await requireAdmin();
  const { q, imported, skipped, dup } = await searchParams;
  const duplicateOf = dup && /^[0-9a-f-]{36}$/.test(dup) ? await getProspect(dup) : null;
  const trimmed = q?.trim();
  const prospects = trimmed ? await searchProspects(trimmed) : await listProspects();

  async function addProspectManually(formData: FormData) {
    'use server';
    await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    const { id, created } = await createProspect({
      name,
      phone: String(formData.get('phone') ?? '').trim() || null,
      source: String(formData.get('source') ?? 'other'),
      note: String(formData.get('note') ?? '').trim() || null,
      nationalId: String(formData.get('nationalId') ?? '').trim() || null,
      companyNumber: String(formData.get('companyNumber') ?? '').trim() || null,
    });
    redirect(created ? '/admin/leads' : `/admin/leads?dup=${id}`);
  }

  async function importList(formData: FormData) {
    'use server';
    await requireAdmin();
    const rows = parseLeadList(String(formData.get('list') ?? ''));
    let added = 0;
    let dup = 0;
    // הכפילויות נעצרות במסד (0024) — גם מול לידים קיימים וגם בתוך הרשימה עצמה.
    for (const row of rows) {
      const { created } = await createProspect({ name: row.name, phone: row.phone, address: row.address, note: row.note, source: 'cold_call' });
      if (created) added += 1;
      else dup += 1;
    }
    redirect(`/admin/leads?imported=${added}&skipped=${dup}`);
  }

  async function importBatch(formData: FormData) {
    'use server';
    await requireAdmin();
    const batch = LEAD_BATCHES.find((b) => b.id === formData.get('batch'));
    if (!batch) return;
    let added = 0;
    let dup = 0;
    for (const row of batchLeads(batch)) {
      const { created } = await createProspect({ name: row.name, phone: row.phone, address: row.address, note: row.note, source: 'cold_call' });
      if (created) added += 1;
      else dup += 1;
    }
    redirect(`/admin/leads?imported=${added}&skipped=${dup}`);
  }

  // כמה מכל סבב כבר במערכת — לפי אותו מפתח טלפון שהמסד אוכף (0024).
  const knownPhones = new Set(
    (trimmed ? await listProspects() : prospects).map((p) => (p.phone ? normalizePhone(p.phone) : '')),
  );
  const batches = LEAD_BATCHES.map((b) => {
    const leads = batchLeads(b);
    const fresh = leads.filter((l) => !knownPhones.has(normalizePhone(l.phone))).length;
    return { ...b, total: leads.length, fresh };
  });

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

      {duplicateOf ? (
        <p className="rounded-md border px-4 py-3 text-[0.88rem]" style={{ borderColor: 'var(--warning)', background: 'var(--warning-quiet)' }}>
          כבר קיים ליד עם המספר הזה, ולא נוצר כפיל:{' '}
          <Link href={`/admin/leads/${duplicateOf.id}`} className="font-medium underline">{duplicateOf.name}</Link>
        </p>
      ) : null}

      {imported !== undefined ? (
        <p className="rounded-md border border-hairline bg-raised px-4 py-3 text-[0.88rem]">
          נוספו {imported} לידים{Number(skipped) > 0 ? ` · ${skipped} כבר היו ברשימה ודולגו` : ''}.
        </p>
      ) : null}

      <section className="rounded-lg border border-hairline p-4">
        <h2 className="text-[0.92rem] font-medium">סבבי לידים מוכנים לחיוג</h2>
        <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
          יבואנים, מפיצים ויצרנים מנתניה והשרון, שנאספו ממדריכי עסקים. מספר שכבר קיים ברשימה מדולג.
        </p>
        <ul className="mt-3 divide-y divide-hairline">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[0.9rem] font-medium">{b.title}</div>
                <div className="text-[0.76rem] text-muted">{b.areas}</div>
              </div>
              {b.fresh === 0 ? (
                <span className="text-[0.82rem]" style={{ color: 'var(--positive)' }}>✓ כל {b.total} ברשימה</span>
              ) : (
                <form action={importBatch}>
                  <input type="hidden" name="batch" value={b.id} />
                  <button type="submit" className="rounded-md px-4 py-2 text-[0.85rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
                    {b.fresh === b.total ? `ייבוא ${b.total} לידים` : `ייבוא ${b.fresh} חדשים מתוך ${b.total}`}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

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

      <details className="rounded-lg border border-hairline p-4">
        <summary className="cursor-pointer text-[0.92rem] font-medium">ייבוא רשימה (הדבקה)</summary>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-muted">
          שורה לכל עסק: שם, טלפון, כתובת ושאר הפרטים, מופרדים ב-| או בטאב — גם טבלה שהועתקה מהמסמך עובדת.
          שורה בלי מספר טלפון תקין מדולגת, וגם מספר שכבר קיים ברשימה.
        </p>
        <form action={importList} className="mt-3 space-y-2.5">
          <textarea
            name="list" rows={6} required
            placeholder="דורמקו | 09-9500040 | יד חרוצים 11, פולג | כימיקלים"
            className="w-full rounded-md border border-strong bg-raised px-3 py-2 text-[0.86rem] outline-none"
          />
          <button type="submit" className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
            ייבוא
          </button>
        </form>
      </details>

      {prospects.length === 0 ? (
        <p className="text-[0.88rem] text-muted">{trimmed ? 'לא נמצא ליד תואם.' : 'עוד אין לידים שמורים.'}</p>
      ) : (
        <LeadList
          prospects={prospects}
          sourceLabels={PROSPECT_SOURCE_LABELS}
        />
      )}
    </div>
  );
}
