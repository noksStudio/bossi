import type { PortDef } from '@bossi/kernel';

/**
 * מימוש זמני לפורט שטרם נבנה. כל קריאה זורקת שגיאה שאומרת בדיוק
 * איזה פורט ואיזו מתודה חסרים — כך שמודול חדש לא "כמעט עובד" בשקט.
 */
export function stubPort<T extends object>(port: PortDef<T>): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      return () => {
        throw new Error(`הפורט ${port.id} טרם מומש (נקראה ${String(prop)})`);
      };
    },
  });
}
