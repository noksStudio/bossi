import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createCampaign, createFacebookGroup, createProspect, deleteCampaign, deleteFacebookGroup,
  deleteProspect, listCampaigns, listFacebookGroups, listProspects, setProspectContacted,
} from '@bossi/db';
import { PlacesSearchError, searchPlaces, type PlaceResult } from '@bossi/integrations';
import { requireAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'שיווק · ניהול' };

type Tab = 'organic' | 'paid';

/**
 * שיווק הפלטפורמה — איך Bossi עצמה מביאה דיירים משלמים חדשים, לא איך
 * דייר מביא את הלקוחות שלו (זה `/leads`, מודול נפרד לגמרי). שני טאבים
 * דרך `searchParams.tab`, בלי state בצד הלקוח: אורגני (קבוצות פייסבוק
 * — רשימה בלבד, בלי פרסום אוטומטי) וממומן (חיפוש Google Places + רשומת
 * קמפיין לתיעוד בלי מדידה אוטומטית).
 */
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await requireAdmin();
  const { tab: rawTab, q } = await searchParams;
  const tab: Tab = rawTab === 'paid' ? 'paid' : 'organic';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-[1.6rem]">שיווק</h1>
        <p className="mt-1 text-[0.88rem] text-muted">מציאת דיירים משלמים חדשים ל-Bossi.</p>
      </div>

      <div className="flex gap-1.5 border-b border-hairline">
        <TabLink tab="organic" active={tab === 'organic'}>אורגני</TabLink>
        <TabLink tab="paid" active={tab === 'paid'}>ממומן</TabLink>
      </div>

      {tab === 'organic' ? <OrganicTab /> : <PaidTab q={q} />}
    </div>
  );
}

function TabLink({ tab, active, children }: { tab: Tab; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={`/admin/marketing?tab=${tab}`}
      className="-mb-px border-b-2 px-3 py-2.5 text-[0.88rem] transition-colors"
      style={{
        borderColor: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </Link>
  );
}

// ── אורגני ───────────────────────────────────────────────────────────────

async function OrganicTab() {
  const groups = await listFacebookGroups();

  async function addGroup(formData: FormData) {
    'use server';
    await requireAdmin();
    const title = String(formData.get('title') ?? '').trim();
    const link = String(formData.get('link') ?? '').trim();
    if (!title || !link) return;
    await createFacebookGroup({ title, link, note: String(formData.get('note') ?? '').trim() || null });
    redirect('/admin/marketing?tab=organic');
  }

  async function removeGroup(formData: FormData) {
    'use server';
    await requireAdmin();
    await deleteFacebookGroup(String(formData.get('id')));
    redirect('/admin/marketing?tab=organic');
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-hairline p-4">
        <h2 className="text-[0.98rem]">קבוצת פייסבוק חדשה</h2>
        <p className="mt-1 text-[0.8rem] text-muted">
          תיעוד בלבד — כתובת לביקור וכתיבת תגובה ידנית, לא פרסום אוטומטי.
        </p>
        <form action={addGroup} className="mt-3 flex flex-wrap gap-2.5">
          <input
            name="title" placeholder="שם הקבוצה" required
            className="min-w-40 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
          <input
            name="link" placeholder="קישור" required dir="ltr"
            className="min-w-52 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
          <input
            name="note" placeholder="הערה (רשות)"
            className="min-w-40 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
          />
          <button type="submit" className="rounded-md px-4 py-2 text-[0.88rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
            הוספה
          </button>
        </form>
      </section>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-strong p-10 text-center">
          <h2 className="text-[1.02rem]">עוד אין קבוצות</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-secondary">
            הוסיפו קבוצות פייסבוק רלוונטיות לקהל היעד — בעלי עסקים קטנים ובינוניים.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
          {groups.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="text-[0.9rem] font-medium">{g.title}</div>
                <a href={g.link} target="_blank" rel="noreferrer" className="block truncate text-[0.78rem] text-muted hover:underline" dir="ltr">
                  {g.link}
                </a>
                {g.note ? <div className="mt-0.5 text-[0.8rem] text-secondary">{g.note}</div> : null}
              </div>
              <form action={removeGroup}>
                <input type="hidden" name="id" value={g.id} />
                <button type="submit" className="shrink-0 text-[0.8rem] text-muted hover:underline" style={{ color: 'var(--danger)' }}>
                  הסרה
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── ממומן ────────────────────────────────────────────────────────────────

async function PaidTab({ q }: { q?: string }) {
  const apiKey = process.env['GOOGLE_PLACES_API_KEY'];
  let results: PlaceResult[] = [];
  let searchError: string | null = null;
  if (q && apiKey) {
    try {
      results = await searchPlaces(q, apiKey);
    } catch (err) {
      searchError = err instanceof PlacesSearchError ? 'החיפוש נכשל — ייתכן שהמפתח לא תקין או שהמכסה נגמרה.' : 'שגיאה לא צפויה. נסו שוב.';
    }
  }

  const [campaigns, prospects] = await Promise.all([listCampaigns(), listProspects()]);

  async function importSelected(formData: FormData) {
    'use server';
    await requireAdmin();
    const parsed = JSON.parse(String(formData.get('resultsJson') ?? '[]')) as PlaceResult[];
    const selected = formData.getAll('selected').map(Number);
    for (const i of selected) {
      const place = parsed[i];
      if (!place) continue;
      await createProspect({ name: place.name, phone: place.phone, address: place.address, website: place.website, source: 'google_places' });
    }
    redirect('/admin/marketing?tab=paid');
  }

  async function toggleContacted(formData: FormData) {
    'use server';
    await requireAdmin();
    await setProspectContacted(String(formData.get('id')), formData.get('contacted') === '1');
    redirect('/admin/marketing?tab=paid');
  }

  async function removeProspect(formData: FormData) {
    'use server';
    await requireAdmin();
    await deleteProspect(String(formData.get('id')));
    redirect('/admin/marketing?tab=paid');
  }

  async function addCampaignAction(formData: FormData) {
    'use server';
    await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    const channel = String(formData.get('channel') ?? '').trim();
    if (!name || !channel) return;
    const budget = String(formData.get('budget') ?? '').trim();
    const startsOn = String(formData.get('startsOn') ?? '').trim();
    const endsOn = String(formData.get('endsOn') ?? '').trim();
    await createCampaign({
      name, channel,
      budget: budget || null,
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    });
    redirect('/admin/marketing?tab=paid');
  }

  async function removeCampaign(formData: FormData) {
    'use server';
    await requireAdmin();
    await deleteCampaign(String(formData.get('id')));
    redirect('/admin/marketing?tab=paid');
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-[1.05rem]">חיפוש עסקים — Google Places</h2>

        {!apiKey ? (
          <div className="rounded-lg border border-dashed border-strong p-6 text-[0.88rem] leading-relaxed text-secondary">
            <p>החיפוש הזה דורש מפתח API של Google Places, ולא הוגדר אחד.</p>
            <p className="mt-2">
              יש להגדיר משתנה סביבה <code dir="ltr" className="rounded bg-sunken px-1.5 py-0.5">GOOGLE_PLACES_API_KEY</code>.
            </p>
          </div>
        ) : (
          <>
            <form className="flex flex-wrap gap-2.5">
              <input type="hidden" name="tab" value="paid" />
              <input
                name="q" defaultValue={q ?? ''} placeholder='למשל: "עורכי דין בתל אביב"'
                className="min-w-64 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
              />
              <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">חפש</button>
            </form>

            {searchError ? <p className="text-[0.85rem]" style={{ color: 'var(--danger)' }}>{searchError}</p> : null}
            {q && !searchError && results.length === 0 ? (
              <p className="text-[0.88rem] text-muted">לא נמצאו תוצאות. נסו שאילתה אחרת.</p>
            ) : null}

            {results.length > 0 ? (
              <form action={importSelected} className="space-y-3">
                <input type="hidden" name="resultsJson" value={JSON.stringify(results)} />
                <p className="text-[0.82rem] text-muted">{results.length} תוצאות · מסומנות כברירת מחדל</p>
                <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                  {results.map((p, i) => (
                    <li key={p.placeId} className="p-3">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" name="selected" value={i} defaultChecked className="mt-1" />
                        <span className="min-w-0 flex-1 text-[0.88rem]">
                          <span className="block font-medium">{p.name}</span>
                          {p.address ? <span className="block text-[0.78rem] text-muted">{p.address}</span> : null}
                          {p.phone ? <span className="block text-[0.78rem] text-muted" dir="ltr">{p.phone}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button type="submit" className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
                  שמירה כפרוספקטים
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[1.05rem]">פרוספקטים</h2>
        {prospects.length === 0 ? (
          <p className="text-[0.88rem] text-muted">עוד אין פרוספקטים שמורים.</p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
            {prospects.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <div className="text-[0.9rem] font-medium">{p.name}</div>
                  {p.address ? <div className="text-[0.78rem] text-muted">{p.address}</div> : null}
                  {p.phone ? <div className="text-[0.78rem] text-muted" dir="ltr">{p.phone}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <form action={toggleContacted}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="contacted" value={p.contacted ? '0' : '1'} />
                    <button type="submit" className="text-[0.8rem] hover:underline" style={{ color: p.contacted ? 'var(--positive)' : 'var(--text-muted)' }}>
                      {p.contacted ? '✓ נוצר קשר' : 'סמן שנוצר קשר'}
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
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[1.05rem]">קמפיינים</h2>
          <p className="mt-1 text-[0.8rem] text-muted">רשומה לתיעוד בלבד — בלי מדידה אוטומטית של תוצאות.</p>
        </div>

        <form action={addCampaignAction} className="grid gap-2.5 rounded-lg border border-hairline p-4 sm:grid-cols-2">
          <input name="name" placeholder="שם הקמפיין" required className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
          <input name="channel" placeholder="ערוץ (Google Ads, פייסבוק...)" required className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
          <input name="budget" type="number" step="0.01" min="0" placeholder="תקציב (₪)" className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
          <div className="flex gap-2.5">
            <input name="startsOn" type="date" className="min-w-0 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
            <input name="endsOn" type="date" className="min-w-0 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none" />
          </div>
          <textarea name="notes" placeholder="הערות" rows={2} className="rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none sm:col-span-2" />
          <button type="submit" className="justify-self-start rounded-md px-4 py-2 text-[0.88rem] font-medium text-white sm:col-span-2" style={{ background: 'var(--accent)' }}>
            הוספת קמפיין
          </button>
        </form>

        {campaigns.length === 0 ? (
          <p className="text-[0.88rem] text-muted">עוד אין קמפיינים מתועדים.</p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 p-3.5">
                <div className="min-w-0 text-[0.88rem]">
                  <div className="font-medium">{c.name} <span className="font-normal text-muted">· {c.channel}</span></div>
                  <div className="mt-0.5 text-[0.78rem] text-muted">
                    {c.budget ? <span>{Number(c.budget).toLocaleString('he-IL')} ₪ · </span> : null}
                    {c.starts_on ? formatDate(c.starts_on) : '—'}
                    {c.ends_on ? ` – ${formatDate(c.ends_on)}` : ''}
                  </div>
                  {c.notes ? <div className="mt-1 text-[0.8rem] text-secondary">{c.notes}</div> : null}
                </div>
                <form action={removeCampaign}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="shrink-0 text-[0.8rem] hover:underline" style={{ color: 'var(--danger)' }}>הסרה</button>
                </form>
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
