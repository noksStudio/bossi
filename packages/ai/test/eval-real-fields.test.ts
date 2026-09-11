import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractAmounts, extractBusinessIds, extractDates } from '../src/extract-fields';
import { extractPdfText } from '../src/extract-text';

/**
 * eval על אותם 10 קבצי דמו אמיתיים — הפעם על חילוץ שדות, לא סיווג.
 *
 * ה-eval הזה בדיוק מה שחשף שני ממצאים אמיתיים: (1) \s? בין מספר
 * לסימן מטבע חצה שורה וחיבר מספר סעיף לא-קשור לסימן ₪ מהשורה הבאה;
 * (2) טבלאות חשבונית/הצעת מחיר כלל לא חוזרות על ₪ ליד כל מספר —
 * "סה"כ לתשלום" בתור תווית הוא האיתות שצריך שם. שני התיקונים ב-ADR-014.
 */

const DEMO_DIR = `${import.meta.dirname}/../../../apps/web/public/demo`;

async function fields(file: string) {
  const bytes = await readFile(`${DEMO_DIR}/${file}`);
  const { pages } = await extractPdfText(bytes);
  return {
    dates: extractDates(pages).map((d) => d.value),
    amounts: extractAmounts(pages).map((a) => a.value),
    ids: extractBusinessIds(pages),
  };
}

describe('eval שדות: קבצי דמו אמיתיים', () => {
  it('חשבונית: מוצאת את הסכום הסופי לתשלום ואת ח.פ. הספק', async () => {
    const { amounts, ids, dates } = await fields('invoice.pdf');
    expect(amounts).toContain(6360); // סה"כ לתשלום
    expect(amounts).toContain(5390); // סה"כ לפני מע"מ
    expect(ids.some((i) => i.value === '514872910' && i.confidence > 0.9)).toBe(true);
    expect(dates).toContain('2026-08-01');
  });

  it('הצעת מחיר: מוצאת את הסכום הסופי', async () => {
    const { amounts } = await fields('quote.pdf');
    expect(amounts).toContain(34031);
  });

  it('קבלה: מוצאת את הסכום ששולם', async () => {
    const { amounts } = await fields('receipt.pdf');
    expect(amounts).toContain(6360);
  });

  it('ערבות בנקאית: מוצאת את סכום הערבות ואת שני תאריכי התוקף', async () => {
    const { amounts, dates } = await fields('bank-guarantee.pdf');
    expect(amounts).toContain(150000);
    expect(dates).toContain('2026-02-20');
    expect(dates).toContain('2027-08-19');
  });

  it('חוזה: מוצא את ח.פ. שני הצדדים ואת תאריך החתימה', async () => {
    const { ids, dates } = await fields('contract.pdf');
    expect(ids.map((i) => i.value)).toEqual(expect.arrayContaining(['514872910', '515993027']));
    expect(dates).toContain('2024-03-12');
  });

  it('תעודת משלוח: לא מוצאת סכומים — היא לא אמורה להכיל מחירים', async () => {
    const { amounts } = await fields('delivery-note.pdf');
    expect(amounts).toEqual([]);
  });

  it('כל 10 קבצי הדמו נותחים בלי לזרוק, גם כשאין להם שדות מהסוג המבוקש', async () => {
    const files = [
      'contract.pdf', 'quote.pdf', 'invoice.pdf', 'receipt.pdf', 'delivery-note.pdf',
      'tax-exemption.pdf', 'insurance.pdf', 'bank-guarantee.pdf', 'meeting-notes.pdf', 'correspondence.pdf',
    ];
    for (const file of files) {
      await expect(fields(file)).resolves.toBeDefined();
    }
  });
});
