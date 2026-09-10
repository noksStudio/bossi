import type { ModuleCategory } from '@bossi/kernel';

/**
 * תוויות הקטגוריה בעברית — מקור אמת יחיד. נצרך גם באדמין (בחירת
 * מודולים לחבילה) וגם בסיידבר של האפליקציה (קיבוץ הניווט), כדי
 * שהמשתמש והמנהל יראו את אותו חיתוך בדיוק.
 */
export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  documents: 'מסמכים',
  money: 'כספים',
  commerce: 'מסחר',
  intelligence: 'בינה',
};

export const CATEGORY_ORDER: readonly ModuleCategory[] = ['documents', 'money', 'commerce', 'intelligence'];
