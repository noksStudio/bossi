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
