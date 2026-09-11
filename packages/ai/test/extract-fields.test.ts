import { describe, expect, it } from 'vitest';
import {
  extractAmounts, extractBusinessIds, extractCounterparties, extractDates, isValidIsraeliBusinessId,
} from '../src/extract-fields';
import type { ExtractedPage } from '../src/extract-text';

function page(num: number, text: string): ExtractedPage[] {
  return [{ num, text }];
}

describe('extractDates', () => {
  it('מוצאת תאריך בודד בפורמט DD.MM.YYYY', () => {
    const [result] = extractDates(page(1, 'תאריך: 12.08.2026'));
    expect(result?.value).toBe('2026-08-12');
    expect(result?.page).toBe(1);
  });

  it('מוצאת כמה תאריכים על פני כמה עמודים, כל אחד עם מספר העמוד הנכון', () => {
    const pages: ExtractedPage[] = [
      { num: 1, text: 'הונפק ב-01.01.2026' },
      { num: 2, text: 'בתוקף עד 31.12.2026' },
    ];
    const results = extractDates(pages);
    expect(results.map((r) => r.value)).toEqual(['2026-01-01', '2026-12-31']);
    expect(results.map((r) => r.page)).toEqual([1, 2]);
  });

  it('תאריך עם יום/חודש בלי אפס מוביל (30.6.2026) גם נתפס', () => {
    const [result] = extractDates(page(1, 'ההצעה בתוקף עד 30.6.2026'));
    expect(result?.value).toBe('2026-06-30');
  });

  it('שנה בת שתי ספרות מתפרשת כ-20XX', () => {
    const [result] = extractDates(page(1, '02.09.26'));
    expect(result?.value).toBe('2026-09-02');
  });

  it('תאריך לא תקין (31 בפברואר) לא נכנס לתוצאות', () => {
    const results = extractDates(page(1, '31.02.2026'));
    expect(results).toEqual([]);
  });

  it('מספר עם סכום (5,390 בפסיק) לא מתפרש בטעות כתאריך', () => {
    const results = extractDates(page(1, 'סה"כ 5,390 ש"ח'));
    expect(results).toEqual([]);
  });
});

describe('extractAmounts', () => {
  it('סכום עם ₪ לפני המספר', () => {
    const [result] = extractAmounts(page(1, 'סה"כ שהתקבל ₪ 6,360'));
    expect(result?.value).toBe(6360);
  });

  it('סכום עם ש"ח אחרי המספר', () => {
    const [result] = extractAmounts(page(1, 'סה"כ לתשלום 5,390 ש"ח'));
    expect(result?.value).toBe(5390);
  });

  it('סכום עם גרשיים עבריות (ש״ח)', () => {
    const [result] = extractAmounts(page(1, 'סכום הערבות 50,000 ש״ח'));
    expect(result?.value).toBe(50000);
  });

  it('סכום עם אגורות (עשרוני)', () => {
    const [result] = extractAmounts(page(1, '199.90 ₪'));
    expect(result?.value).toBeCloseTo(199.9);
  });

  it('מספר בלי סימן מטבע בכלל לא נחשב סכום', () => {
    const results = extractAmounts(page(1, 'מספר הסכם: 2024-118'));
    expect(results).toEqual([]);
  });
});

describe('isValidIsraeliBusinessId — אלגוריתם ביקורת', () => {
  it('514872910 (ח.פ. אמיתי מנתוני הדמו) עובר ביקורת', () => {
    expect(isValidIsraeliBusinessId('514872910')).toBe(true);
  });

  it('515993027 (ח.פ. אחר מנתוני הדמו) לא עובר — לא נוצר עם ביקורת תקנית', () => {
    // ממצא אמיתי: לא כל המספרים בנתוני הדמו הם ח.פ. תקינים באמת,
    // ולכן ולידציה נוקשה (שער ולא ניקוד) הייתה פוסלת מסמכים אמיתיים.
    expect(isValidIsraeliBusinessId('515993027')).toBe(false);
  });

  it('לא באורך 9 ספרות — לא תקין', () => {
    expect(isValidIsraeliBusinessId('12345')).toBe(false);
    expect(isValidIsraeliBusinessId('1234567890')).toBe(false);
  });

  it('לא ספרות בכלל — לא תקין, לא זורק', () => {
    expect(isValidIsraeliBusinessId('abcdefghi')).toBe(false);
  });
});

describe('extractBusinessIds', () => {
  it('מספר 9 ספרות באותה שורה עם "ח.פ" נתפס, עם ביטחון גבוה אם עובר ביקורת', () => {
    const [result] = extractBusinessIds(page(1, 'לביא ושות׳ — משרד עורכי דין · 514872910 ח״פ'));
    expect(result?.value).toBe('514872910');
    expect(result?.confidence).toBeGreaterThan(0.9);
  });

  it('מספר שלא עובר ביקורת עדיין מוחזר, בביטחון נמוך יותר — לא שער', () => {
    const [result] = extractBusinessIds(page(1, 'עוסק מורשה 515993027'));
    expect(result?.value).toBe('515993027');
    expect(result?.confidence).toBeLessThan(0.9);
  });

  it('מספר 9 ספרות בלי תווית "ח.פ"/"עוסק" בשורה לא נתפס', () => {
    const results = extractBusinessIds(page(1, 'אסמכתא: 514872910'));
    expect(results).toEqual([]);
  });

  it('"עוסק פטור" נתפס כמו "עוסק מורשה"', () => {
    const [result] = extractBusinessIds(page(1, 'עוסק פטור מס\' 203236658'));
    expect(result?.value).toBe('203236658');
  });

  it('"ת.ז" נתפסת כמו "ח.פ" — לקוח פרטי מזוהה באותה צורה', () => {
    const [result] = extractBusinessIds(page(1, 'שם: דני כהן · ת.ז. 514872910'));
    expect(result?.value).toBe('514872910');
  });

  it('"ת״ז" (גרשיים) ו"תעודת זהות" (מילה מלאה) שתיהן נתפסות', () => {
    expect(extractBusinessIds(page(1, 'ת״ז 514872910'))).toHaveLength(1);
    expect(extractBusinessIds(page(1, 'תעודת זהות 514872910'))).toHaveLength(1);
  });
});

describe('extractCounterparties', () => {
  it('"לכבוד:" נעצר בנקודה האמצעית ולא בולע את התווית שאחריה', () => {
    const [result] = extractCounterparties(page(1, 'לכבוד: מעבדות תבל בע״מ · ח״פ 512883004'));
    expect(result?.name).toBe('מעבדות תבל בע״מ');
    expect(result?.role).toBe('לכבוד');
  });

  it('"לבין:" ו"בין:" (בלי ל) נתפסים כשני מועמדים נפרדים על אותה שורה', () => {
    const results = extractCounterparties(
      page(1, '(״הלקוח״) בין: ד. כהן עיצוב בע״מ, ח״פ לבין: לביא ושות׳'),
    );
    // "בין:" ו"לבין:" נבחנים בנפרד — שני הצדדים כמועמדים, לא רק אחד.
    const roles = results.map((r) => r.role);
    expect(roles).toContain('צד בהסכם');
    expect(results.some((r) => r.name === 'לביא ושות׳')).toBe(true);
  });

  it('"התקבל מאת:" לא נתפס גם כ"מאת" (בלי כפילות)', () => {
    const results = extractCounterparties(page(1, 'התקבל מאת: ד. כהן עיצוב בע״מ'));
    expect(results).toHaveLength(1);
    expect(results[0]?.role).toBe('התקבל מאת');
  });

  it('"מאת" עצמאי (שולח מייל) מסיר את כתובת האימייל בסוגריים המשולשים', () => {
    const [result] = extractCounterparties(page(1, 'מאת\t<nissim@example.co.il> ניסים חדד'));
    expect(result?.name).toBe('ניסים חדד');
    expect(result?.confidence).toBeLessThan(0.6);
  });

  it('שורה בלי אף תווית מוכרת לא מחזירה כלום', () => {
    expect(extractCounterparties(page(1, 'שורה רגילה בלי שום דבר מיוחד'))).toEqual([]);
  });

  it('שם קצר מדי אחרי תווית (פחות משני תווים) לא נכנס לתוצאות', () => {
    expect(extractCounterparties(page(1, 'לכבוד: א'))).toEqual([]);
  });

  it('כל מועמד נושא מספר עמוד נכון', () => {
    const pages: ExtractedPage[] = [
      { num: 1, text: 'עמוד ראשון בלי כלום' },
      { num: 2, text: 'לכבוד: חברת בדיקה בע״מ' },
    ];
    const [result] = extractCounterparties(pages);
    expect(result?.page).toBe(2);
  });
});
