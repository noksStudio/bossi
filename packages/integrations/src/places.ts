/**
 * מקור לידים: חיפוש עסקים ב-Google Places (Text Search, v1) — לא
 * שליחה, רק בניית רשימת יעד. **אין כתובת מייל בתשובה בכלל** — ה-API
 * מחזיר שם, כתובת, טלפון ואתר בלבד. זו לא מגבלה שצריך לעקוף: זה
 * בדיוק מה שמכוון את הפעולה הבאה לטלפון/מכתב, לא לספאם וואטסאפ/מייל
 * אוטומטי (ראה השיחה שהובילה לספרינט הזה).
 */

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
}

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
}

export class PlacesSearchError extends Error {}

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri';

/**
 * חיפוש חופשי — "עורכי דין בתל אביב" עובד טוב יותר מקטגוריה+עיר
 * נפרדות, כי כך ה-API של גוגל מתוכנן לקבל שאילתה (Text Search, לא
 * Nearby Search שדורש קואורדינטות במקום טקסט).
 */
export async function searchPlaces(query: string, apiKey: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: trimmed, languageCode: 'he' }),
  });

  if (!res.ok) {
    throw new PlacesSearchError(`Google Places החזיר ${res.status}`);
  }

  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? [])
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text?.trim() ?? '',
      address: p.formattedAddress ?? null,
      phone: p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
    }))
    .filter((p) => p.name.length > 0);
}
