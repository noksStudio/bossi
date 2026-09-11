import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractCounterparties } from '../src/extract-fields';
import { extractPdfText } from '../src/extract-text';

/**
 * eval על 10 קבצי הדמו האמיתיים — חילוץ שם צד נגדי (ספרינט ד׳, שלב 2).
 * כמו בכל eval קודם בחבילה הזו, זו הדרך היחידה לגלות באגים אמיתיים:
 * תוויות אמיתיות בעברית משתנות בניסוח (״לכבוד״ מול ״מבוטח״ מול ״לבקשת״),
 * וסדר-התווים החזותי של PDF+RTL (ADR-014) הופך שורות שלמות.
 *
 * שני מקרים ידועים ומתועדים מראש:
 * - delivery-note.pdf: "לכבוד: מוסך הצפון" בלבד, בלי "(2011) בע״מ" —
 *   החלק הזה של השם נדבק מוקדם יותר בשורה בגלל הסדר החזותי ההפוך.
 *   עדיין מספיק לחיפוש fuzzy מול טבלת הלקוחות (ספרינט הבא).
 * - contract.pdf: שני מועמדים (שני הצדדים), כולל "לביא ושות׳" — הדייר
 *   עצמו. זה מכוון: שכבת ההתאמה היא זו שתפתור מי מהם לקוח אמיתי.
 */

const DEMO_DIR = `${import.meta.dirname}/../../../apps/web/public/demo`;

async function counterparties(file: string) {
  const bytes = await readFile(`${DEMO_DIR}/${file}`);
  const { pages } = await extractPdfText(bytes);
  return extractCounterparties(pages);
}

describe('eval צד נגדי: קבצי דמו אמיתיים', () => {
  it('הצעת מחיר: "לכבוד" מוצא את שם הלקוח המלא', async () => {
    const results = await counterparties('quote.pdf');
    expect(results.some((r) => r.name === 'מעבדות תבל בע״מ' && r.role === 'לכבוד')).toBe(true);
  });

  it('חשבונית: "לכבוד" מוצא את שם הלקוח המלא', async () => {
    const results = await counterparties('invoice.pdf');
    expect(results.some((r) => r.name === 'ד. כהן עיצוב בע״מ')).toBe(true);
  });

  it('קבלה: "התקבל מאת" מוצא את שם המשלם', async () => {
    const results = await counterparties('receipt.pdf');
    expect(results.some((r) => r.name === 'ד. כהן עיצוב בע״מ' && r.role === 'התקבל מאת')).toBe(true);
  });

  it('חוזה: מוצא את שני הצדדים, כולל הדייר עצמו כמועמד נמוך-ביטחון', async () => {
    const results = await counterparties('contract.pdf');
    const names = results.map((r) => r.name);
    expect(names).toContain('ד. כהן עיצוב בע״מ');
    expect(names).toContain('לביא ושות׳');
  });

  it('תעודת משלוח: מוצא לפחות את החלק הראשון של שם הלקוח (ידוע: חלקי בגלל RTL)', async () => {
    const results = await counterparties('delivery-note.pdf');
    expect(results.some((r) => r.name.includes('מוסך הצפון'))).toBe(true);
  });

  it('אישור ניכוי מס: "שם העוסק" מוצא את שם הלקוח', async () => {
    const results = await counterparties('tax-exemption.pdf');
    expect(results.some((r) => r.name === 'ד. כהן עיצוב בע״מ' && r.role === 'שם העוסק')).toBe(true);
  });

  it('אישור קיום ביטוחים: "מבוטח" מוצא את שם המבוטח', async () => {
    const results = await counterparties('insurance.pdf');
    expect(results.some((r) => r.name === 'מעבדות תבל תעשיות בע״מ' && r.role === 'מבוטח')).toBe(true);
  });

  it('ערבות בנקאית: "לבקשת" מוצא את מבקש הערבות', async () => {
    const results = await counterparties('bank-guarantee.pdf');
    expect(results.some((r) => r.name === 'י. פרידמן מתכות ובניו בע״מ' && r.role === 'לבקשת')).toBe(true);
  });

  it('סיכום פגישה: "לקוח" מוצא את שם הלקוח', async () => {
    const results = await counterparties('meeting-notes.pdf');
    expect(results.some((r) => r.name === 'טכנוסופט פתרונות תוכנה בע״מ')).toBe(true);
  });

  it('תכתובת: "מאת" מוצא את שם השולח בביטחון נמוך, בלי כתובת המייל', async () => {
    const results = await counterparties('correspondence.pdf');
    const sender = results.find((r) => r.role === 'שולח');
    expect(sender?.name).toBe('ניסים חדד');
    expect(sender?.confidence).toBeLessThan(0.6);
  });

  it('כל 10 קבצי הדמו נותחים בלי לזרוק', async () => {
    const files = [
      'contract.pdf', 'quote.pdf', 'invoice.pdf', 'receipt.pdf', 'delivery-note.pdf',
      'tax-exemption.pdf', 'insurance.pdf', 'bank-guarantee.pdf', 'meeting-notes.pdf', 'correspondence.pdf',
    ];
    for (const file of files) {
      await expect(counterparties(file)).resolves.toBeDefined();
    }
  });
});
