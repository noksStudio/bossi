/// <reference path="./pdfjs-worker.d.ts" />
import { PDFParse } from 'pdf-parse';
// pdfjs-dist (שמאחורי pdf-parse) טוען את ה-worker שלו ב-Node עם
// import() דינמי, יחסי למיקום הקובץ המקובץ שלו בזמן ריצה. תחת webpack
// (route handler של Next.js) הנתיב הזה נשבר — הקובץ הפיזי לא מועתק
// לתיקיית הפלט של ה-route. `globalThis.pdfjsWorker` הוא ה-hook
// הרשמי של pdfjs-dist בדיוק למקרה הזה: כשהוא קיים, ה-import()
// הדינמי מדולג לגמרי. import סטטי רגיל (בניגוד לדינמי) כן נארז
// כמו שצריך על ידי webpack, ולכן זו הדרך היחידה שעובדת גם מקומית
// (tsx/vitest) וגם דרך Next.js build בלי הבדל בין הסביבות.
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';

(globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler } })
  .pdfjsWorker = { WorkerMessageHandler };

/**
 * חילוץ טקסט מ-PDF — לא AI, לא OCR. פונקציה דטרמיניסטית שקוראת את
 * שכבת הטקסט המובנית בקובץ (CLAUDE.md כלל 3/4: מודל שפה מסווג
 * ומחלץ, אבל שום דבר כאן לא "מחליט" — זו רק קריאת מה שכבר כתוב).
 *
 * מסמך סרוק (תמונה בלבד, בלי שכבת טקסט) מחזיר `text` ריק או כמעט
 * ריק — זו תוצאה תקינה ומצופה, לא שגיאה. OCR אמיתי לסריקות הוא
 * שלב נפרד ויקר יותר, נדחה עד שיש נפח אמיתי (CLAUDE.md: "להוסיף
 * רק מול כאב מדוד").
 */
export interface ExtractedPage {
  num: number;
  text: string;
}

export interface ExtractedText {
  text: string;
  pageCount: number;
  /** טקסט לפי עמוד — העוגן ל"page" שחילוץ שדות (ADR-014) נושא לכל התאמה. */
  pages: ExtractedPage[];
}

export async function extractPdfText(bytes: Buffer): Promise<ExtractedText> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return {
      text: result.text,
      pageCount: result.total,
      pages: result.pages.map((p) => ({ num: p.num, text: p.text })),
    };
  } finally {
    await parser.destroy();
  }
}

/** האם יש מספיק טקסט אמיתי להמשיך איתו לסיווג/חילוץ, או שזו כנראה סריקה. */
export function hasExtractableText(extracted: { text: string }): boolean {
  return extracted.text.trim().length >= 20;
}
