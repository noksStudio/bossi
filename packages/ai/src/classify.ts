/**
 * סיווג מסמכים לפי כללים — לא AI חיצוני, לא LLM. ניקוד מילות מפתח
 * דטרמיניסטי, בדיוק התפקיד ש-CLAUDE.md כלל 3/4 משאיר ל"AI פנימי":
 * מסווג עם confidence, לא מחליט. מתחת לסף (0.8, כמו שכבר קיים
 * ב-`doc_type_confidence` בסכמה) → תור אישור אנושי כרגיל.
 *
 * הפונקציה עצמה לא יודעת כלום על "מסמכים" של Bossi — `classifyText`
 * מקבלת חוקים כפרמטר וניתנת לבדיקה עם כל קבוצת כללים. `DOCUMENT_TYPE_RULES`
 * למטה הוא הכלל-ספר האמיתי של 11 סוגי המסמך, אבל הוא נתון, לא לוגיקה.
 */

export interface Keyword {
  /** תת-מחרוזת לחיפוש בטקסט, כמו שהוא — לא regex. */
  phrase: string;
  /** ביטוי ארוך ומיוחד (3+ מילים) שקולים יותר מסתם מילה בודדת. */
  weight: number;
}

export interface Rule {
  type: string;
  keywords: Keyword[];
}

export interface ClassificationResult {
  /** `null` כשאף כלל לא התאים בכלל — אין ניחוש, יש "לא ידוע". */
  type: string | null;
  confidence: number;
  /** הניקוד הגולמי של כל סוג — לצורך eval ודיבוג, לא רק התוצאה הסופית. */
  scores: Record<string, number>;
}

/** מעל הניקוד הזה תוצאה יחידה נחשבת "חזקה" ולא מדוכאת בחישוב הביטחון. */
const STRONG_SCORE = 5;

export function classifyText(text: string, rules: Rule[]): ClassificationResult {
  const scores: Record<string, number> = {};

  for (const rule of rules) {
    let score = 0;
    for (const { phrase, weight } of rule.keywords) {
      if (text.includes(phrase)) score += weight;
    }
    if (score > 0) scores[rule.type] = score;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { type: null, confidence: 0, scores };

  const [bestType, best] = ranked[0]!;
  const second = ranked[1]?.[1] ?? 0;

  const margin = best / (best + second);
  const magnitude = Math.min(1, best / STRONG_SCORE);
  const confidence = margin * magnitude;

  return { type: bestType, confidence, scores };
}

/**
 * כלל-ספר Bossi: 11 סוגי המסמך מ-`DOC_TYPES` (`@bossi/db`) — מזהי
 * הסוג כאן הם אותם מחרוזות בדיוק, בכוונה בלי לייבא את הטיפוס משם
 * (packages/ai לא תלוי ב-packages/db — ראו CLAUDE.md כלל 6, אותו
 * עיקרון מיושם רמה אחת מעל המודולים עצמם).
 */
export const DOCUMENT_TYPE_RULES: Rule[] = [
  {
    type: 'contract',
    keywords: [
      { phrase: 'הסכם למתן שירותים', weight: 3 },
      { phrase: 'תנאי ההסכם', weight: 2 },
      { phrase: 'הצדדים להסכם', weight: 2 },
      { phrase: 'תוקף ההסכם', weight: 2 },
      { phrase: 'ביטול ההסכם', weight: 2 },
      { phrase: 'הסכם שכירות', weight: 3 },
      { phrase: 'הסכם', weight: 1 },
      { phrase: 'חוזה', weight: 1 },
    ],
  },
  {
    type: 'quote',
    keywords: [
      { phrase: 'הצעת מחיר', weight: 3 },
      { phrase: 'תוקף ההצעה', weight: 2 },
      { phrase: 'ההצעה בתוקף עד', weight: 3 },
      { phrase: 'המחיר אינו כולל מע"מ', weight: 2 },
      { phrase: 'סה"כ להצעה', weight: 2 },
    ],
  },
  {
    type: 'invoice',
    keywords: [
      { phrase: 'חשבונית מס', weight: 3 },
      { phrase: 'חשבונית עסקה', weight: 3 },
      { phrase: 'מספר חשבונית', weight: 2 },
      { phrase: 'סה"כ לתשלום', weight: 2 },
      { phrase: 'כולל מע"מ', weight: 1 },
      { phrase: 'חשבונית', weight: 1 },
    ],
  },
  {
    type: 'receipt',
    keywords: [
      { phrase: 'קבלה על סך', weight: 3 },
      { phrase: 'סה"כ שהתקבל', weight: 3 },
      { phrase: 'התקבל מאת', weight: 2 },
      { phrase: 'שולם במלואו', weight: 2 },
      { phrase: 'מס׳ קבלה', weight: 2 },
      { phrase: 'אישור תשלום', weight: 2 },
      { phrase: 'התקבל תשלום', weight: 2 },
      { phrase: 'קבלה', weight: 1 },
    ],
  },
  {
    type: 'delivery_note',
    keywords: [
      { phrase: 'תעודת משלוח', weight: 3 },
      { phrase: 'פרטי המשלוח', weight: 2 },
      { phrase: 'כמות שנשלחה', weight: 2 },
    ],
  },
  {
    type: 'tax_exemption',
    keywords: [
      { phrase: 'אישור ניכוי מס במקור', weight: 3 },
      { phrase: 'ניכוי מס במקור', weight: 3 },
      { phrase: 'פטור מניכוי', weight: 2 },
      { phrase: 'שיעור הניכוי', weight: 2 },
      { phrase: 'רשות המסים', weight: 1 },
    ],
  },
  {
    type: 'insurance',
    keywords: [
      { phrase: 'אישור קיום ביטוח', weight: 3 },
      { phrase: 'פוליסת ביטוח', weight: 2 },
      { phrase: 'תוקף הפוליסה', weight: 2 },
      { phrase: 'ביטוח אחריות', weight: 2 },
      { phrase: 'ביטוח צד ג', weight: 2 },
      { phrase: 'חברת הביטוח', weight: 1 },
    ],
  },
  {
    type: 'bank_guarantee',
    keywords: [
      { phrase: 'ערבות בנקאית', weight: 3 },
      { phrase: 'ערבות אוטונומית', weight: 3 },
      { phrase: 'ערבות בלתי מותנית', weight: 3 },
      { phrase: 'סכום הערבות', weight: 2 },
      { phrase: 'תוקף הערבות', weight: 2 },
      { phrase: 'הבנק המנפיק', weight: 2 },
    ],
  },
  {
    type: 'meeting_notes',
    keywords: [
      { phrase: 'סיכום פגישה', weight: 3 },
      { phrase: 'סיכום פגישת', weight: 3 }, // צורת סמיכות: "סיכום פגישת סטטוס"
      { phrase: 'סיכום ישיבה', weight: 3 },
      { phrase: 'משימות להמשך', weight: 2 },
      { phrase: 'נושאי הישיבה', weight: 2 },
      { phrase: 'הוחלט', weight: 2 },
      { phrase: 'נדון', weight: 1 },
      { phrase: 'אחראי', weight: 1 },
      { phrase: 'משתתפים', weight: 1 },
      { phrase: 'החלטות', weight: 1 },
    ],
  },
  {
    type: 'correspondence',
    keywords: [
      { phrase: 'תכתובת מייל', weight: 3 },
      { phrase: 'התכתבות בנושא', weight: 3 },
      { phrase: 'בהמשך לפנייתך', weight: 3 },
      { phrase: 'בהמשך ל', weight: 2 },
      { phrase: 'הנדון:', weight: 2 },
      { phrase: 'לכבוד', weight: 1 },
      { phrase: 'בברכה', weight: 1 },
      { phrase: 'שלום רב', weight: 1 },
    ],
  },
];

export function classifyDocument(text: string): ClassificationResult {
  return classifyText(text, DOCUMENT_TYPE_RULES);
}
