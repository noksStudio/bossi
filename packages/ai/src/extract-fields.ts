import type { ExtractedPage } from './extract-text';

/**
 * חילוץ שדות — regex + heuristics, לא AI. כל התאמה נושאת `confidence`
 * ועוגן (`page`), כמו ש-CLAUDE.md כלל 4 דורש מכל חילוץ. "עוגן" כאן
 * הוא מספר עמוד ולא bbox — pdf-parse נותן טקסט לפי עמוד, לא קואורדינטות;
 * עוגן ברמת bbox ידרוש שלב חילוץ מלא יותר, נדחה עד שיש בו צורך.
 *
 * שורות מעורבות עברית/מספרים (CLAUDE.md, ספרינט א׳) עלולות להציג את
 * תופעת סדר-התווים של PDF+RTL — אבל **הספרות עצמן לעולם לא מתהפכות**,
 * רק סדר המילים העבריות סביבן. לכן כל החיפושים כאן מתבססים על תבנית
 * הספרות עצמה ועל קרבה לשורה (לא על "המילה חייבת לבוא ממש לפני
 * המספר"), וזה מה שהופך אותם לעמידים בפני התופעה.
 */

export interface ExtractedField<T> {
  value: T;
  raw: string;
  page: number;
  confidence: number;
}

// ── תאריכים ──────────────────────────────────────────────────────────────

const DATE_RE = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g;

function toIsoDate(day: number, month: number, year: number): string | null {
  const fullYear = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(fullYear, month - 1, day));
  // תאריך כמו 31.02 נבלע ל-3 במרץ ב-Date — זה סימן שהוא לא היה תקין מלכתחילה.
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

export function extractDates(pages: ExtractedPage[]): Array<ExtractedField<string>> {
  const results: Array<ExtractedField<string>> = [];
  for (const page of pages) {
    for (const match of page.text.matchAll(DATE_RE)) {
      const [raw, d, m, y] = match;
      const iso = toIsoDate(Number(d), Number(m), Number(y));
      if (!iso) continue;
      results.push({ value: iso, raw: raw!, page: page.num, confidence: 0.9 });
    }
  }
  return results;
}

// ── סכומים ───────────────────────────────────────────────────────────────

// [ \t]? ולא \s? בכוונה: מספר וסימן מטבע צמודים על אותה שורה בלבד.
// שורת מעבר (למשל מספר סעיף שנדבק בטעות לתחילת השורה הבאה בחילוץ
// RTL) לא אמורה לחבר בין השניים — זה בדיוק מה שקרה עם "תמורה2\n₪".
const CURRENCY_AFTER_RE = /([\d,]+(?:\.\d{1,2})?)[ \t]?(?:₪|ש["״]ח)/g;
const CURRENCY_BEFORE_RE = /₪[ \t]?([\d,]+(?:\.\d{1,2})?)/g;

/**
 * טבלת שורות (חשבונית/הצעת מחיר) לרוב לא חוזרת על ₪ בכל תא — המטבע
 * מובן מהקשר הטבלה, לא כתוב ליד כל מספר. "סה"כ לתשלום" הוא בדיוק
 * השדה הכי חשוב לחלץ מחשבונית, ולכן תווית מפורשת + מספר על אותה
 * שורה היא איתות מספיק חזק גם בלי סימן מטבע — ראו ADR-014.
 */
const LABELED_TOTAL_RE = /(סה["״]כ לתשלום|סה["״]כ)[^\d\n]{0,15}([\d,]+(?:\.\d{1,2})?)/g;

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

export function extractAmounts(pages: ExtractedPage[]): Array<ExtractedField<number>> {
  const results: Array<ExtractedField<number>> = [];
  for (const page of pages) {
    for (const re of [CURRENCY_AFTER_RE, CURRENCY_BEFORE_RE]) {
      for (const match of page.text.matchAll(re)) {
        const value = parseAmount(match[1]!);
        if (!Number.isFinite(value) || value <= 0) continue;
        results.push({ value, raw: match[0], page: page.num, confidence: 0.85 });
      }
    }
    for (const match of page.text.matchAll(LABELED_TOTAL_RE)) {
      const value = parseAmount(match[2]!);
      if (!Number.isFinite(value) || value <= 0) continue;
      const isFinalTotal = match[1]!.includes('לתשלום');
      results.push({ value, raw: match[0], page: page.num, confidence: isFinalTotal ? 0.9 : 0.65 });
    }
  }
  return results;
}

// ── מספרי ח.פ. / עוסק מורשה ────────────────────────────────────────────

// "ח.פ" או "ח״פ" (גרשיים אמיתיות, לא גרש כפול רגיל) — שני העיצובים נפוצים.
const ID_LABEL_RE = /ח\s?["״.]?\s?פ\.?|עוסק\s?(?:מורשה|פטור)/;
const NINE_DIGITS_RE = /\b\d{9}\b/g;

/**
 * ולידציית ביקורת ישראלית סטנדרטית (אותו אלגוריתם לת.ז. ולח.פ.).
 * **לא שער** — משפיעה על confidence, לא על הופעת המועמד. גם ח.פ.
 * אמיתיים בנתוני הדמו הקיימים לא תמיד עוברים אותה (מספרים בדויים
 * שלא נוצרו עם ביקורת תקנית), ולכן דרישה נוקשה הייתה פוסלת מסמכים
 * אמיתיים.
 */
export function isValidIsraeliBusinessId(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let step = Number(id[i]) * ((i % 2) + 1);
    if (step > 9) step -= 9;
    sum += step;
  }
  return sum % 10 === 0;
}

export function extractBusinessIds(pages: ExtractedPage[]): Array<ExtractedField<string>> {
  const results: Array<ExtractedField<string>> = [];
  for (const page of pages) {
    for (const line of page.text.split('\n')) {
      if (!ID_LABEL_RE.test(line)) continue;
      for (const match of line.matchAll(NINE_DIGITS_RE)) {
        const id = match[0];
        results.push({
          value: id,
          raw: id,
          page: page.num,
          confidence: isValidIsraeliBusinessId(id) ? 0.95 : 0.6,
        });
      }
    }
  }
  return results;
}

// ── צד נגדי (counterparty) ──────────────────────────────────────────────

export interface ExtractedCounterparty {
  name: string;
  role: string;
  raw: string;
  page: number;
  confidence: number;
}

interface CounterpartyLabel {
  role: string;
  re: RegExp;
  confidence: number;
  stripEmail?: boolean;
}

/**
 * תוויות שאחריהן מגיע שם הצד השני, לפי סוג מסמך: "לכבוד"/"התקבל מאת"
 * בחשבונית/קבלה, "מבוטח"/"לבקשת"/"לטובת" באישור ביטוח/ערבות, "לבין"/"בין"
 * בחוזה (שני הצדדים, במכוון — הצד שהוא בעל הדייר עצמו פשוט לא ימצא
 * התאמה בשכבת ההתאמה, ראו ספרינט ה׳), "לקוח" בסיכום פגישה, "שם העוסק"
 * באישור ניכוי מס. "מאת" (בלי "התקבל") הוא שולח מייל — אדם, לא בהכרח
 * שם החברה, ולכן ביטחון נמוך משמעותית.
 *
 * "בין"/"לטובת" מסומנים בביטחון נמוך יותר: מהדוגמאות האמיתיות הם
 * לרוב הצד שהוא הדייר עצמו ולא הלקוח (הדייר הוא נותן השירות/הנהנה).
 */
const COUNTERPARTY_LABELS: CounterpartyLabel[] = [
  { role: 'לכבוד', re: /לכבוד\s*:/, confidence: 0.85 },
  { role: 'צד בהסכם', re: /לבין\s*:/, confidence: 0.75 },
  { role: 'צד בהסכם', re: /(?<!ל)בין\s*:/, confidence: 0.6 },
  { role: 'התקבל מאת', re: /התקבל\s*מאת\s*:/, confidence: 0.85 },
  { role: 'מבוטח', re: /מבוטח\s*:/, confidence: 0.85 },
  { role: 'לבקשת', re: /לבקשת\s*:/, confidence: 0.8 },
  { role: 'לטובת', re: /לטובת\s*:/, confidence: 0.6 },
  { role: 'לקוח', re: /לקוח\s*:/, confidence: 0.85 },
  { role: 'שם העוסק', re: /שם\s*העוסק/, confidence: 0.8 },
  { role: 'שולח', re: /(?<!התקבל\s)מאת\s*[:\t]?/, confidence: 0.5, stripEmail: true },
];

// גבול השם: תו הפרדה נפוץ, או תחילת תווית סמוכה ("ח״פ", "עוסק מורשה"),
// או תחילת ציון תפקיד בסוגריים ("(״הלקוח״)").
const NAME_BOUNDARY_RE = /[·,\t\n(]|ח\s?["״.]?\s?פ\.?\b|עוסק\s?(?:מורשה|פטור)/;

export function extractCounterparties(pages: ExtractedPage[]): ExtractedCounterparty[] {
  const results: ExtractedCounterparty[] = [];
  for (const page of pages) {
    for (const line of page.text.split('\n')) {
      for (const label of COUNTERPARTY_LABELS) {
        const match = label.re.exec(line);
        if (!match) continue;

        let rest = line.slice(match.index + match[0].length).replace(/^[\s:]+/, '');
        if (label.stripEmail) rest = rest.replace(/<[^>]*>/g, '');
        const boundary = rest.search(NAME_BOUNDARY_RE);
        const name = (boundary >= 0 ? rest.slice(0, boundary) : rest).trim();
        if (name.length < 2) continue;

        results.push({
          name, role: label.role, raw: `${match[0]}${name}`, page: page.num, confidence: label.confidence,
        });
      }
    }
  }
  return results;
}
