import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacesSearchError, searchPlaces } from '../src/places';

/**
 * בלי מפתח API אמיתי (זה מגיע מהמשתמש, לא מסופק על ידינו) — הבדיקות
 * כאן ממקדות ב-fetch מדומה ומוודאות שני דברים: הבקשה בנויה נכון
 * (endpoint, headers, גוף), והתשובה מפורשת נכון — כולל המקרה שחסר בו
 * שדה (עסק בלי אתר/טלפון עדיין תקין, לא שגיאה).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('searchPlaces', () => {
  it('שולחת בקשה עם ה-endpoint, ה-headers והגוף הנכונים', async () => {
    const fetchMock = mockFetch(200, { places: [] });
    await searchPlaces('עורכי דין בתל אביב', 'test-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toContain('places.displayName');
    expect(JSON.parse(init.body)).toEqual({ textQuery: 'עורכי דין בתל אביב', languageCode: 'he' });
  });

  it('מפרשת תוצאה מלאה נכון', async () => {
    mockFetch(200, {
      places: [{
        id: 'ChIJ123',
        displayName: { text: 'עורכי דין כהן ושות׳' },
        formattedAddress: 'רוטשילד 1, תל אביב',
        internationalPhoneNumber: '+972 3-1234567',
        websiteUri: 'https://cohen-law.co.il',
      }],
    });
    const [result] = await searchPlaces('עורכי דין', 'k');
    expect(result).toEqual({
      placeId: 'ChIJ123',
      name: 'עורכי דין כהן ושות׳',
      address: 'רוטשילד 1, תל אביב',
      phone: '+972 3-1234567',
      website: 'https://cohen-law.co.il',
    });
  });

  it('עסק בלי טלפון/אתר עדיין תקין — שדות חסרים הופכים ל-null, לא שגיאה', async () => {
    mockFetch(200, { places: [{ id: 'x', displayName: { text: 'עסק בלי פרטים' } }] });
    const [result] = await searchPlaces('שאילתה', 'k');
    expect(result?.phone).toBeNull();
    expect(result?.website).toBeNull();
    expect(result?.address).toBeNull();
  });

  it('תוצאה בלי שם בכלל מסוננת החוצה', async () => {
    mockFetch(200, { places: [{ id: 'x' }, { id: 'y', displayName: { text: 'יש שם' } }] });
    const results = await searchPlaces('שאילתה', 'k');
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('יש שם');
  });

  it('תשובה בלי places בכלל מחזירה מערך ריק, לא זורקת', async () => {
    mockFetch(200, {});
    expect(await searchPlaces('שאילתה', 'k')).toEqual([]);
  });

  it('שגיאת HTTP (מפתח לא תקין, מכסה) זורקת PlacesSearchError', async () => {
    mockFetch(403, { error: 'PERMISSION_DENIED' });
    await expect(searchPlaces('שאילתה', 'bad-key')).rejects.toThrow(PlacesSearchError);
  });

  it('שאילתה ריקה מחזירה מערך ריק בלי לקרוא ל-fetch בכלל', async () => {
    const fetchMock = mockFetch(200, { places: [] });
    expect(await searchPlaces('   ', 'k')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
