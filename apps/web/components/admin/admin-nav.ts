export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * ניווט קונסולת הפלטפורמה — קבוע, לא נגזר ממודולים כמו הניווט של
 * הדייר. אדמין הפלטפורמה לא "מרכיב" נתיבים לפי חבילה; יש לו את אותן
 * ארבע תיקיות תמיד.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'דיירים', icon: 'Building' },
  { href: '/admin/marketing', label: 'שיווק', icon: 'Megaphone' },
  { href: '/admin/packages', label: 'חבילות', icon: 'Boxes' },
  { href: '/admin/system', label: 'מערכת', icon: 'Gauge' },
];
