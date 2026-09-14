export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * ניווט קונסולת הפלטפורמה — קבוע, לא נגזר ממודולים כמו הניווט של
 * הדייר. אדמין הפלטפורמה לא "מרכיב" נתיבים לפי חבילה; יש לו את אותן
 * חמש תיקיות תמיד.
 *
 * `לידים` נפרד מ`שיווק` בכוונה: שיווק הן הפעילויות שמביאות לידים
 * (קבוצות פייסבוק, חיפוש Google Places, קמפיינים) — לידים היא רשימת
 * העבודה עצמה, עם חיפוש. ראה ADR-026.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'דיירים', icon: 'Building' },
  { href: '/admin/leads', label: 'לידים', icon: 'Target' },
  { href: '/admin/marketing', label: 'שיווק', icon: 'Megaphone' },
  { href: '/admin/packages', label: 'חבילות', icon: 'Boxes' },
  { href: '/admin/system', label: 'מערכת', icon: 'Gauge' },
];
