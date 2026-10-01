import { isIsraeliPhone, normalizePhone } from './phone';

export interface ParsedLead {
  name: string;
  phone: string;
  address: string | null;
  note: string | null;
}

const MAX_ROWS = 500;

/**
 * רשימת לידים מודבקת → שורות. התאים מופרדים ב-| או בטאב (טבלה שהועתקה
 * ממסמך מגיעה בטאבים). עמודת הטלפון מזוהה לפי התוכן ולא לפי מיקום, כי
 * כל רשימה מסודרת אחרת: השם = התא הראשון שאינו טלפון, הכתובת = התא שאחרי
 * הטלפון, וכל השאר להערה. שורה בלי טלפון ישראלי תקין (כותרת, שורה ריקה)
 * מדולגת.
 */
export function parseLeadList(raw: string): ParsedLead[] {
  const rows: ParsedLead[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (rows.length >= MAX_ROWS) break;
    const cells = line
      .split(/\t|\|/)
      .map((c) => c.trim().replace(/^\[(.+?)\]\(.*\)$/, '$1'))
      .filter((c) => c.length > 0);

    const phoneIdx = cells.findIndex((c) => isIsraeliPhone(normalizePhone(c)));
    if (phoneIdx < 0) continue;
    const nameIdx = cells.findIndex((_, i) => i !== phoneIdx);
    if (nameIdx < 0) continue;
    const addressIdx = phoneIdx + 1 < cells.length && phoneIdx + 1 !== nameIdx ? phoneIdx + 1 : -1;

    const rest = cells.filter((_, i) => i !== phoneIdx && i !== nameIdx && i !== addressIdx);
    rows.push({
      name: cells.at(nameIdx)!.slice(0, 160),
      phone: cells.at(phoneIdx)!,
      address: addressIdx >= 0 ? cells.at(addressIdx)!.slice(0, 200) : null,
      note: rest.length > 0 ? rest.join(' · ').slice(0, 500) : null,
    });
  }
  return rows;
}
