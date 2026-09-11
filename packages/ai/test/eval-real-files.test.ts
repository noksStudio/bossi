import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { classifyDocument } from '../src/classify';
import { extractPdfText } from '../src/extract-text';

/**
 * ה-eval האמיתי: 10 מ-11 סוגי המסמך (הכול חוץ מ"אחר", שהוא קליטת-כל
 * ולא סוג ספציפי) יש להם קובץ דמו אמיתי תחת public/demo — לא טקסט
 * שהוקלד ביד בשביל הבדיקה. זו הדרך היחידה לדעת אם החוקים מתאימים
 * למציאות ולא רק לדוגמאות שבחרתי כדי שיעברו.
 *
 * ביטחון נמוך על תוצאה נכונה (למשל 0.45) הוא תקין ומצופה — לא כל
 * מסמך אמיתי עמוס במילות המפתח הכי חזקות שלו, וזה בדיוק המקרה
 * שאמור לנחות בתור אישור אנושי (סף 0.8) במקום להתחזות לוודאות.
 */

const DEMO_DIR = `${import.meta.dirname}/../../../apps/web/public/demo`;

const REAL_FILES: Record<string, string> = {
  'contract.pdf': 'contract',
  'quote.pdf': 'quote',
  'invoice.pdf': 'invoice',
  'receipt.pdf': 'receipt',
  'delivery-note.pdf': 'delivery_note',
  'tax-exemption.pdf': 'tax_exemption',
  'insurance.pdf': 'insurance',
  'bank-guarantee.pdf': 'bank_guarantee',
  'meeting-notes.pdf': 'meeting_notes',
  'correspondence.pdf': 'correspondence',
};

describe('eval: קבצי דמו אמיתיים', () => {
  it.each(Object.entries(REAL_FILES))('%s מסווג כ-%s', async (file, expectedType) => {
    const bytes = await readFile(`${DEMO_DIR}/${file}`);
    const { text } = await extractPdfText(bytes);
    const result = classifyDocument(text);
    expect(result.type).toBe(expectedType);
  });

  it('דיוק על כל 10 קבצי הדמו האמיתיים הוא 100%', async () => {
    let correct = 0;
    for (const [file, expectedType] of Object.entries(REAL_FILES)) {
      const bytes = await readFile(`${DEMO_DIR}/${file}`);
      const { text } = await extractPdfText(bytes);
      if (classifyDocument(text).type === expectedType) correct++;
    }
    expect(correct).toBe(Object.keys(REAL_FILES).length);
  });
});
