import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createCampaign, createFacebookGroup, createProspect, deleteCampaign, deleteFacebookGroup,
  listCampaigns, listFacebookGroups, listProspects,
} from '@bossi/db';
import { PlacesSearchError, searchPlaces, type PlaceResult } from '@bossi/integrations';
import { requireAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'שיווק · ניהול' };

type Tab = 'organic' | 'paid' | 'cold';

/**
 * שיווק הפלטפורמה — הפעילויות שמביאות לידים ל-Bossi, לא הלידים
 * עצמם (זו תיקיית `/admin/leads` הנפרדת, ADR-026). שני טאבים דרך
 * `searchParams.tab`: אורגני (קבוצות פייסבוק — רשימה בלבד, בלי
 * פרסום אוטומטי) וממומן (חיפוש Google Places + רשומת קמפיין לתיעוד
 * בלי מדידה אוטומטית).
 */
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; qt?: string; qc?: string }>;
}) {
  await requireAdmin();
  const { tab: rawTab, q, qt, qc } = await searchParams;
  const tab: Tab = rawTab === 'paid' ? 'paid' : rawTab === 'cold' ? 'cold' : 'organic';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.6rem]">שיווק</h1>
          <p className="mt-1 text-[0.88rem] text-muted">הפעילויות שמביאות דיירים משלמים חדשים ל-Bossi.</p>
        </div>
        <Link href="/admin/leads" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">כל הלידים ←</Link>
      </div>

      <div className="flex gap-1.5 border-b border-hairline">
        <TabLink tab="organic" active={tab === 'organic'}>אורגני</TabLink>
        <TabLink tab="paid" active={tab === 'paid'}>ממומן</TabLink>
        <TabLink tab="cold" active={tab === 'cold'}>לידים קרים</TabLink>
      </div>

      {tab === 'organic' ? <OrganicTab /> : tab === 'paid' ? <PaidTab q={q} qt={qt} qc={qc} /> : <ColdLeadsTab />}
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

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-strong px-3 py-1.5 text-[0.82rem]"
      style={active ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' } : undefined}
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

const SEARCH_TYPES = ['יבואן', 'סיטונאות', 'מפיץ', 'שיווק והפצה', 'יצרן', 'עמיל מכס'];
const SEARCH_CITIES = [
  'נתניה', 'הרצליה', 'כפר סבא', 'רעננה', 'הוד השרון', 'פתח תקווה',
  'ראש העין', 'בני ברק', 'תל אביב', 'חולון', 'ראשון לציון', 'אשדוד',
];

function paidHref(qt?: string, qc?: string): string {
  const p = new URLSearchParams({ tab: 'paid' });
  if (qt) p.set('qt', qt);
  if (qc) p.set('qc', qc);
  return `/admin/marketing?${p}`;
}

/** Places מחזיר ‎+972 9-887-3565, הזנה ידנית היא 09-8873565 — משווים ספרות בלבד. */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) digits = `0${digits.slice(3)}`;
  return digits || null;
}

async function PaidTab({ q, qt, qc }: { q?: string; qt?: string; qc?: string }) {
  const apiKey = process.env['GOOGLE_PLACES_API_KEY'];
  const query = q?.trim() || (qt && qc ? `${qt} ב${qc}` : undefined);
  let results: PlaceResult[] = [];
  let searchError: string | null = null;
  if (query && apiKey) {
    try {
      results = await searchPlaces(query, apiKey);
    } catch (err) {
      searchError = err instanceof PlacesSearchError ? 'החיפוש נכשל — ייתכן שהמפתח לא תקין או שהמכסה נגמרה.' : 'שגיאה לא צפויה. נסו שוב.';
    }
  }

  // חיפושים חופפים ("יבואן" ו"מפיץ" באותה עיר) מחזירים את אותם עסקים —
  // מה שכבר בתיקיית הלידים מסומן ולא נבחר כברירת מחדל.
  const known = new Set<string>();
  if (results.length > 0) {
    for (const p of await listProspects()) {
      const phone = normalizePhone(p.phone);
      if (phone) known.add(phone);
      known.add(p.name.trim().toLowerCase());
    }
  }
  const isKnown = (p: PlaceResult) => {
    const phone = normalizePhone(p.phone);
    return (phone !== null && known.has(phone)) || known.has(p.name.trim().toLowerCase());
  };
  const newCount = results.filter((p) => !isKnown(p)).length;
  const backHref = q?.trim() ? `/admin/marketing?${new URLSearchParams({ tab: 'paid', q: q.trim() })}` : paidHref(qt, qc);

  const campaigns = await listCampaigns();

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
    // חזרה לאותו חיפוש — העסקים שיובאו מופיעים עכשיו כ"כבר ברשימה",
    // וממשיכים לצירוף הבא בלי לאבד את המקום.
    const back = String(formData.get('back') ?? '');
    redirect(back.startsWith('/admin/marketing?') ? back : '/admin/leads');
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
            <div className="space-y-3 rounded-lg border border-hairline p-4">
              <div>
                <p className="text-[0.8rem] text-muted">סוג עסק</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SEARCH_TYPES.map((t) => (
                    <Chip key={t} href={paidHref(t, qc)} active={!q && qt === t}>{t}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[0.8rem] text-muted">עיר</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SEARCH_CITIES.map((c) => (
                    <Chip key={c} href={paidHref(qt, c)} active={!q && qc === c}>{c}</Chip>
                  ))}
                </div>
              </div>
              {!q && (qt || qc) && !(qt && qc) ? (
                <p className="text-[0.8rem] text-muted">{qt ? 'בחרו עיר' : 'בחרו סוג עסק'} — החיפוש ירוץ אוטומטית.</p>
              ) : null}
            </div>

            <form className="flex flex-wrap gap-2.5">
              <input type="hidden" name="tab" value="paid" />
              <input
                name="q" defaultValue={query ?? ''} placeholder='או חיפוש חופשי: "יבואני כלי בית באשדוד"'
                className="min-w-64 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
              />
              <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">חפש</button>
            </form>

            {searchError ? <p className="text-[0.85rem]" style={{ color: 'var(--danger)' }}>{searchError}</p> : null}
            {query && !searchError && results.length === 0 ? (
              <p className="text-[0.88rem] text-muted">לא נמצאו תוצאות. נסו שאילתה אחרת.</p>
            ) : null}

            {results.length > 0 ? (
              <form action={importSelected} className="space-y-3">
                <input type="hidden" name="resultsJson" value={JSON.stringify(results)} />
                <input type="hidden" name="back" value={backHref} />
                <p className="text-[0.82rem] text-muted">
                  {results.length} תוצאות · {newCount} חדשות מסומנות
                  {results.length > newCount ? ` · ${results.length - newCount} כבר ברשימה` : ''}
                </p>
                <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                  {results.map((p, i) => (
                    <li key={p.placeId} className="p-3" style={isKnown(p) ? { opacity: 0.55 } : undefined}>
                      <label className="flex items-start gap-3">
                        <input type="checkbox" name="selected" value={i} defaultChecked={!isKnown(p)} className="mt-1" />
                        <span className="min-w-0 flex-1 text-[0.88rem]">
                          <span className="block font-medium">
                            {p.name}
                            {isKnown(p) ? <span className="ms-2 text-[0.75rem] font-normal text-muted">כבר ברשימה</span> : null}
                          </span>
                          {p.address ? <span className="block text-[0.78rem] text-muted">{p.address}</span> : null}
                          {p.phone ? <span className="block text-[0.78rem] text-muted" dir="ltr">{p.phone}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button type="submit" className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white" style={{ background: 'var(--accent)' }}>
                  שמירה כלידים
                </button>
              </form>
            ) : null}
          </>
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

// ── לידים קרים ───────────────────────────────────────────────────────────

type ColdSource = { title: string; url: string; note?: string };
type ColdGroup = { region: string; sources: ColdSource[] };

/**
 * מדריכים חיצוניים לאיתור לידים קרים לחיוג — לא מאגר פנימי. הקישורים
 * מובילים לדפי קטגוריה מסוננים בספריות עסקים ישראליות; אין להם API,
 * אז האיסוף הוא ידני — פותחים, מעתיקים שם+טלפון לכרטיסייה ב-/admin/leads.
 */
const COLD_LEAD_SOURCES: ColdGroup[] = [
  {
    region: 'נתניה',
    sources: [
      { title: 'יבואנים בנתניה — B144', url: 'https://www.b144.co.il/%D7%99%D7%91%D7%95%D7%90/%D7%A0%D7%AA%D7%A0%D7%99%D7%94/' },
      { title: 'חברות שיווק והפצה בנתניה — B144', url: 'https://www.b144.co.il/%D7%A9%D7%99%D7%95%D7%95%D7%A7-%D7%95%D7%94%D7%A4%D7%A6%D7%94/%D7%A0%D7%AA%D7%A0%D7%99%D7%94/' },
      { title: 'סיטונאות מזון בנתניה — B144', url: 'https://www.b144.co.il/%D7%99%D7%91%D7%95%D7%90-%D7%9E%D7%96%D7%95%D7%9F/%D7%A0%D7%AA%D7%A0%D7%99%D7%94/' },
    ],
  },
  {
    region: 'השרון (אזורי)',
    sources: [
      { title: 'יבואנים באזור השרון — Easy', url: 'https://easy.co.il/list/Importers?region=11' },
      { title: 'יבוא ויצוא חקלאי באזור השרון — B144', url: 'https://www.b144.co.il/%D7%99%D7%A6%D7%95%D7%90-%D7%95%D7%99%D7%91%D7%95%D7%90-%D7%97%D7%A7%D7%9C%D7%90%D7%99/%D7%90%D7%96%D7%95%D7%A8-%D7%94%D7%A9%D7%A8%D7%95%D7%9F/', note: 'רלוונטי לספקים חקלאיים/מזון' },
    ],
  },
];

function ColdLeadsTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-hairline p-4">
        <h2 className="text-[0.98rem]">יעד נוכחי</h2>
        <p className="mt-1 text-[0.88rem] leading-relaxed text-secondary">
          יבואנים ומפיצי B2B באזור נתניה-השרון. איסוף ידני — אין API לספריות האלה.
        </p>
      </section>

      {COLD_LEAD_SOURCES.map((group) => (
        <section key={group.region} className="space-y-2.5">
          <h2 className="text-[0.95rem] text-muted">{group.region}</h2>
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
            {group.sources.map((s) => (
              <li key={s.url} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[0.9rem] font-medium hover:underline">
                    {s.title}
                  </a>
                  {s.note ? <div className="mt-0.5 text-[0.78rem] text-muted">{s.note}</div> : null}
                </div>
                <a
                  href={s.url} target="_blank" rel="noreferrer"
                  className="shrink-0 rounded-md border border-strong px-3 py-1.5 text-[0.82rem]"
                >
                  פתיחה ←
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-lg border border-dashed border-strong p-4">
        <h2 className="text-[0.9rem]">איך להשתמש</h2>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-secondary">
          פותחים קישור, עוברים על העסקים ברשימה, ולכל עסק רלוונטי מעתיקים שם + טלפון
          ישירות לכרטיסיית ליד חדשה ב<Link href="/admin/leads" className="underline">תיקיית הלידים</Link>.
          לפני חיוג — לוודא את מספר הטלפון מול הדף המקורי; ספריות אלה לפעמים מציגות מידע לא מעודכן.
        </p>
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL');
}
