import { describe, expect, it } from 'vitest';
import { classifyDocument, classifyText, type Rule } from '../src/classify';

describe('classifyText — האלגוריתם, בלי תלות בכלל-ספר של Bossi', () => {
  const rules: Rule[] = [
    { type: 'a', keywords: [{ phrase: 'foo bar baz', weight: 3 }, { phrase: 'foo', weight: 1 }] },
    { type: 'b', keywords: [{ phrase: 'qux', weight: 3 }] },
  ];

  it('טקסט בלי אף התאמה מחזיר type null וביטחון 0', () => {
    const result = classifyText('nothing matches here at all', rules);
    expect(result.type).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.scores).toEqual({});
  });

  it('התאמה יחידה חזקה נותנת ביטחון גבוה — margin=1 (אין מתחרה) כפול magnitude=4/5', () => {
    const result = classifyText('this has foo bar baz in it', rules);
    expect(result.type).toBe('a');
    expect(result.scores['a']).toBe(4); // 3 + 1, כי "foo" גם מוכל בתוך "foo bar baz"
    expect(result.confidence).toBeCloseTo(0.8, 5);
  });

  it('התאמה יחידה חלשה (מילה אחת בלבד) נותנת ביטחון נמוך — לא מתחזה לוודאות', () => {
    // "qux" לבד שווה 3 מתוך STRONG_SCORE=5 — magnitude=0.6, margin=1 (אין מתחרה)
    const result = classifyText('just qux and nothing else', rules);
    expect(result.type).toBe('b');
    expect(result.confidence).toBeCloseTo(0.6, 5);
  });

  it('שני סוגים עם ניקוד קרוב מורידים ביטחון — עמימות אמיתית', () => {
    const tied: Rule[] = [
      { type: 'a', keywords: [{ phrase: 'alpha', weight: 3 }] },
      { type: 'b', keywords: [{ phrase: 'beta', weight: 3 }] },
    ];
    const result = classifyText('this text has both alpha and beta in it', tied);
    // margin = 3/(3+3) = 0.5, magnitude = min(1, 3/5) = 0.6 → confidence = 0.3
    expect(result.confidence).toBeCloseTo(0.3, 5);
  });

  it('הסוג עם הניקוד הגבוה ביותר מנצח, גם כשיש כמה התאמות', () => {
    const result = classifyText('qux appears, and also foo bar baz shows up here', rules);
    expect(result.type).toBe('a'); // 4 מול 3
  });
});

describe('DOCUMENT_TYPE_RULES — eval על קורפוס עברי מתויג ביד', () => {
  const labeled: Array<{ type: string; text: string }> = [
    {
      type: 'contract',
      text: 'הסכם למתן שירותים בין הצדדים. תוקף ההסכם הוא 12 חודשים. ביטול ההסכם בהודעה של 30 יום מראש.',
    },
    { type: 'contract', text: 'הסכם שכירות לנכס ברחוב הרצל 5, תל אביב. תנאי ההסכם מפורטים בנספח א.' },
    {
      type: 'quote',
      text: 'הצעת מחיר למתן שירותי ייעוץ. ההצעה בתוקף עד 30.6.2026. המחיר אינו כולל מע"מ.',
    },
    {
      type: 'invoice',
      text: 'חשבונית מס מספר 2291. סה"כ לתשלום 5,390 ש"ח כולל מע"מ. תאריך פירעון 30 יום.',
    },
    { type: 'receipt', text: 'קבלה על סך 1,200 ש"ח. אישור תשלום עבור שירותי ייעוץ. התקבל תשלום במזומן.' },
    {
      type: 'delivery_note',
      text: 'תעודת משלוח מספר 4482. פרטי המשלוח: 3 ארגזים. כמות שנשלחה: 45 יחידות.',
    },
    {
      type: 'tax_exemption',
      text: 'אישור ניכוי מס במקור בשיעור 0%. פטור מניכוי בהתאם לאישור רשות המסים. תוקף עד סוף השנה.',
    },
    {
      type: 'insurance',
      text: 'אישור קיום ביטוח מטעם חברת הביטוח. ביטוח אחריות כלפי צד ג בתוקף הפוליסה עד 31.12.',
    },
    {
      type: 'bank_guarantee',
      text: 'ערבות בנקאית אוטונומית ובלתי מותנית. סכום הערבות 50,000 ש"ח. תוקף הערבות עד תום הפרויקט.',
    },
    {
      type: 'meeting_notes',
      text: 'סיכום פגישה מיום ראשון. משתתפים: דני ורותי. החלטות: לאשר את התקציב. משימות להמשך: לשלוח חוזה.',
    },
    {
      type: 'correspondence',
      text: 'לכבוד מר כהן, שלום רב. בהמשך לפנייתך מיום שני, מצ"ב המסמכים המבוקשים. בברכה, המשרד.',
    },
  ];

  it.each(labeled)('מסווגת "$type" נכון, בביטחון $type >= 0.8', ({ type, text }) => {
    const result = classifyDocument(text);
    expect(result.type).toBe(type);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('דיוק על כל הקורפוס המתויג הוא 100% (11/11) — F1 מלא על מדגם קטן ומכוון', () => {
    const correct = labeled.filter(({ type, text }) => classifyDocument(text).type === type).length;
    expect(correct).toBe(labeled.length);
  });

  it('טקסט שלא שייך לאף סוג לא מקבל סיווג בטוח מדי', () => {
    const result = classifyDocument('יום שלישי בבוקר ירד גשם והכביש היה רטוב מאוד באזור המרכז.');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('טקסט ריק לגמרי מחזיר null, לא זורק', () => {
    expect(classifyDocument('').type).toBeNull();
  });

  // eval נגד קבצי דמו אמיתיים — לא רק דוגמאות שהוקלדו ביד — נמצא ב-eval-real-files.test.ts
});
