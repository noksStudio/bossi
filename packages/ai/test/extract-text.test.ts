import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractPdfText, hasExtractableText } from '../src/extract-text';

/**
 * אין קבצי דוגמה בינאריים מצורפים — כל PDF נבנה כאן במקום, עם pdf-lib
 * (dev בלבד), עם טקסט ידוע מראש. כך הבדיקה משוכפלת ואין קובץ שרקוב
 * להחזיק. התוכן באנגלית בכוונה: pdf-lib דורש הטמעת פונט מותאם כדי
 * לצייר עברית, וזה לא מה שנבדק כאן — המנגנון עצמו אדיש לשפה, ו-ב'
 * (סיווג לפי מילות מפתח בעברית) הוא המקום שבו השפה כן משנה.
 */

async function buildPdf(pages: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage([300, 300]);
    page.drawText(text, { x: 20, y: 250, size: 14, font });
  }
  return Buffer.from(await doc.save());
}

describe('extractPdfText', () => {
  it('מחלצת בדיוק את הטקסט שנכתב לדף', async () => {
    const bytes = await buildPdf(['Invoice Total: 1500 NIS']);
    const result = await extractPdfText(bytes);
    expect(result.text).toContain('Invoice Total: 1500 NIS');
    expect(result.pageCount).toBe(1);
  });

  it('סופרת דפים נכון במסמך מרובה-עמודים', async () => {
    const bytes = await buildPdf(['Page one content', 'Page two content', 'Page three content']);
    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBe(3);
    expect(result.text).toContain('Page one content');
    expect(result.text).toContain('Page three content');
  });

  it('PDF בלי טקסט בכלל לא זורק, ולא נחשב טקסט מספיק להמשך', async () => {
    // pdf-parse מוסיף סמן הפרדה בין עמודים ("-- 1 of 1 --") גם לדף
    // ריק — זה לא תוכן אמיתי, ולכן הבדיקה היא hasExtractableText
    // ולא שוויון מדויק למחרוזת ריקה.
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]); // דף ריק לגמרי — מדמה מסמך סרוק בלי OCR
    const bytes = Buffer.from(await doc.save());

    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBe(1);
    expect(hasExtractableText(result)).toBe(false);
  });

  it('בייטים שהם לא PDF בכלל נכשלים בזריקה ברורה, לא בתקיעה שקטה', async () => {
    const garbage = Buffer.from('this is not a pdf file at all');
    await expect(extractPdfText(garbage)).rejects.toThrow();
  });
});

describe('hasExtractableText', () => {
  it('טקסט קצר מדי (סביר שזו סריקה) נחשב לא מספיק', () => {
    expect(hasExtractableText({ text: 'x' })).toBe(false);
    expect(hasExtractableText({ text: '   ' })).toBe(false);
  });

  it('טקסט אמיתי מספיק', () => {
    expect(hasExtractableText({ text: 'Invoice Total: 1500 NIS, due 30 days' })).toBe(true);
  });
});
