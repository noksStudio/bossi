import type { NavEntry } from './types';

/**
 * ניווט שקיים תמיד, לכל דייר, בלי קשר להרכבת המודולים שלו.
 *
 * דשבורד ולקוחות אינם "יכולת" שמודול מספק ואפשר לכבות — הם התשתית
 * שעליה כל מודול אחר נבנה. מסמכים, צ'קים, חוזים, הזמנות — כולם
 * מצביעים אל `customers`; אין הרכבה שבה כרטיס הלקוח לא רלוונטי.
 *
 * לכן זה חי כאן, בקרנל, ולא כמניפסט מודול ב-`registry.all()`:
 * מודול יכול להיכבות ולהיפלט מ"כל מודול שייך לפחות לחבילה אחת"
 * (ראה `plans.test.ts`) — זה לא, וזה בדיוק ההבדל.
 */
export const CORE_NAV: readonly NavEntry[] = [
  { id: 'core.dashboard', label: 'דשבורד', href: '/dashboard', order: 0, realm: 'staff', icon: 'LayoutDashboard' },
  { id: 'core.customers', label: 'לקוחות', href: '/customers', order: 5, realm: 'staff', icon: 'Users' },
];
