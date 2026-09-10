import { PDFParse } from 'pdf-parse';

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
export interface ExtractedText {
  text: string;
  pageCount: number;
}

export async function extractPdfText(bytes: Buffer): Promise<ExtractedText> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

/** האם יש מספיק טקסט אמיתי להמשיך איתו לסיווג/חילוץ, או שזו כנראה סריקה. */
export function hasExtractableText(extracted: ExtractedText): boolean {
  return extracted.text.trim().length >= 20;
}
