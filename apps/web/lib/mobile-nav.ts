import type { NavEntry } from '@bossi/kernel';

/**
 * פיצול טהור, בטוח לצד-לקוח — בלי גישה למסד (בשונה מ-`lib/navigation.ts`,
 * שמייבא `@bossi/db` ואסור לו להגיע לחבילת ה-client).
 */

export interface MobileNavSplit {
  primary: NavEntry[];
  overflow: NavEntry[];
}

/**
 * מפצלת ניווט ממוין (`shell.nav`, כבר לפי `order`) ל"5 הכי חשובים"
 * לתפריט התחתון בנייד. עד חמישה פריטים — הכול נכנס ישירות. מעל זה,
 * ארבעת הראשונים (החשובים ביותר) בשורה, והשאר מאחורי "עוד" — כדי
 * שהשורה תישאר בת חמישה יעדים בדיוק, גם כשיש עשרות מודולים דלוקים.
 */
export function splitMobileNav(nav: NavEntry[], max = 5): MobileNavSplit {
  if (nav.length <= max) return { primary: nav, overflow: [] };
  return { primary: nav.slice(0, max - 1), overflow: nav.slice(max - 1) };
}
