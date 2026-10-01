import { isIsraeliPhone, normalizePhone } from './phone';

/**
 * קישור `wa.me` עם מלל מוכן מראש — לא שליחה אוטומטית. לוחצים, נפתח
 * וואטסאפ עם הודעה מנוסחת, ואדם שולח בעצמו. שום אינטגרציה, שום API,
 * שום דבר שיכול להישבר או לדרוש אישור עסקי מ-WhatsApp (ADR-028).
 */
export function waLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const international = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

/** נייד ישראלי (05x) — לנייח אין וואטסאפ, אז לא ממלאים אותו מראש. */
export function isIsraeliMobile(phone: string): boolean {
  const n = normalizePhone(phone);
  return n !== null && isIsraeliPhone(n) && n.startsWith('05');
}

/** 054-1234567 / +972 54… → 972541234567, הפורמט ש-wa.me מצפה לו. null אם המספר לא תקין. */
export function toWhatsAppNumber(phone: string): string | null {
  const n = normalizePhone(phone);
  return n !== null && isIsraeliPhone(n) ? `972${n.slice(1)}` : null;
}

/** כמו `waLink`, אבל רק למספר ישראלי תקין — כאן המספר מוקלד ידנית באמצע שיחה. */
export function whatsAppHref(phone: string, text: string): string | null {
  const number = toWhatsAppNumber(phone);
  return number ? waLink(number, text) : null;
}

/**
 * ההודעה שנשלחת תוך כדי השיחה. מוצג כיעקב אליה, עצמאי — לא כ"חברה"
 * (ההחלטה מהתסריט). הקישור מוביל למסך הכניסה, שם הדמואים בלחיצה.
 */
export function demoInviteMessage({ contactName, link }: { contactName?: string | null; link: string }): string {
  const name = contactName?.trim();
  return [
    `${name ? `היי ${name}` : 'היי'}, כאן יעקב אליה, בהמשך לשיחה שלנו.`,
    '',
    'כמו שסיפרתי, אני בונה מערכות מותאמות אישית לבעלי עסקים: הזמנות, לקוחות, מלאי, גבייה ומסמכים, הכול במקום אחד.',
    '',
    'כאן אפשר להיכנס לדמו חי ולראות איך זה נראה, בלי הרשמה, בלחיצה על אחד הדמואים:',
    link,
    '',
    'אשמח לשמוע מה חשבת.',
  ].join('\n');
}
