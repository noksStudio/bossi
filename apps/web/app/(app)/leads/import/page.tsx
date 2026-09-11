import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asPrincipal, createLead, createNote, publishEvent } from '@bossi/db';
import { PlacesSearchError, searchPlaces, type PlaceResult } from '@bossi/integrations';
import { requirePrincipal } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ייבוא לידים מ-Google Places' };

/**
 * חיפוש עסקים ב-Google Places וייבוא כלידים — לא שליחה, בניית רשימת
 * יעד בלבד. אין כתובת מייל בתשובה של גוגל, רק שם/כתובת/טלפון/אתר —
 * הפרטים שאין להם עמודה ייעודית ב-leads נשמרים כרישום ראשון בתיקיית
 * הליד (notes, subject_type='lead'), לא מומצאת עמודה חדשה בשבילם.
 */
export default async function ImportLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePrincipal();
  const { q } = await searchParams;
  const apiKey = process.env['GOOGLE_PLACES_API_KEY'];

  let results: PlaceResult[] = [];
  let error: string | null = null;
  if (q && apiKey) {
    try {
      results = await searchPlaces(q, apiKey);
    } catch (err) {
      error = err instanceof PlacesSearchError ? 'החיפוש נכשל — ייתכן שהמפתח לא תקין או שהמכסה נגמרה.' : 'שגיאה לא צפויה. נסו שוב.';
    }
  }

  async function importSelected(formData: FormData) {
    'use server';
    const principal = await requirePrincipal();
    const parsed = JSON.parse(String(formData.get('resultsJson') ?? '[]')) as PlaceResult[];
    const selected = formData.getAll('selected').map(Number);

    await asPrincipal(principal, async (tx) => {
      for (const i of selected) {
        const place = parsed[i];
        if (!place) continue;

        const leadId = await createLead(tx, {
          displayName: place.name,
          source: 'google_places',
          contactPhone: place.phone,
        });
        await publishEvent(tx, {
          type: 'leads.created',
          actorType: 'user',
          actorId: principal.userId,
          subjectType: 'lead',
          subjectId: leadId,
          payload: { displayName: place.name, source: 'google_places' },
        });

        if (place.address || place.website) {
          const lines = [
            'יובא מ-Google Places',
            place.address ? `כתובת: ${place.address}` : null,
            place.website ? `אתר: ${place.website}` : null,
          ].filter(Boolean);
          await createNote(tx, { body: lines.join('\n'), subjectType: 'lead', subjectId: leadId });
        }
      }
    });

    redirect('/leads');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <nav className="text-[0.8rem] text-muted">
        <Link href="/leads" className="hover:text-primary">לידים</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span>ייבוא מ-Google Places</span>
      </nav>

      <h1 className="text-[1.5rem]">ייבוא לידים מ-Google Places</h1>

      {!apiKey ? (
        <div className="rounded-lg border border-dashed border-strong p-6 text-[0.88rem] leading-relaxed text-secondary">
          <p>החיפוש הזה דורש מפתח API של Google Places, ולא הוגדר אחד.</p>
          <p className="mt-2">
            צריך חשבון Google Cloud עם Places API (New) מופעל וחיוב פעיל, ולהגדיר את המפתח
            כמשתנה סביבה <code dir="ltr" className="rounded bg-sunken px-1.5 py-0.5">GOOGLE_PLACES_API_KEY</code>.
          </p>
        </div>
      ) : (
        <>
          <form className="flex flex-wrap gap-2.5">
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder='למשל: "עורכי דין בתל אביב"'
              className="min-w-64 flex-1 rounded-md border border-strong bg-raised px-3 py-2 text-[0.9rem] outline-none"
            />
            <button type="submit" className="rounded-md border border-strong px-4 py-2 text-[0.88rem]">
              חפש
            </button>
          </form>

          {error ? <p className="text-[0.85rem]" style={{ color: 'var(--danger)' }}>{error}</p> : null}

          {q && !error && results.length === 0 ? (
            <p className="text-[0.88rem] text-muted">לא נמצאו תוצאות. נסו שאילתה אחרת.</p>
          ) : null}

          {results.length > 0 ? (
            <form action={importSelected} className="space-y-4">
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
              <button
                type="submit"
                className="rounded-md px-4 py-2.5 text-[0.9rem] font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                ייבא לידים מסומנים
              </button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
