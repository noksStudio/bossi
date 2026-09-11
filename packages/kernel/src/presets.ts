import type { ModuleId } from './types';

/**
 * חבילות מוכנות. `business_type` של דייר הוא בסך הכול חבילה כזו —
 * ולכן ההבחנה בין "עסק שירותים" ל"עסק B2B" היא הרכבה, לא מוצר נפרד.
 * לקוח יכול תמיד להוסיף או להוריד מודול בודד מעל החבילה.
 */
export const PRESETS = {
  /** התחלה זולה: מסמכים בלבד. הדלת הכי רחבה לכניסה. */
  documents: ['documents', 'search', 'metering'],

  /** עסקי שירותים — עורכי דין, רו"ח, סוכנויות, יועצים. */
  services: ['leads', 'documents', 'search', 'billing', 'collections', 'retainers', 'alerts', 'metering'],

  /** עסקי מוצר B2B — יבואנים, מפיצים, ספקים. */
  commerce: [
    'leads',
    'documents',
    'search',
    'billing',
    'collections',
    'catalog',
    'inventory',
    'orders',
    'portal',
    'alerts',
    'metering',
  ],

  /** נדל״ן להשכרה — נכסים, חוזים, צ׳קים דחויים והחתמה. */
  realestate: [
    'leads', 'documents', 'search', 'signing', 'billing', 'collections',
    'leases', 'checks', 'alerts', 'metering',
  ],

  /** הכול. */
  full: [
    'leads',
    'documents',
    'search',
    'billing',
    'collections',
    'retainers',
    'catalog',
    'inventory',
    'orders',
    'portal',
    'alerts',
    'metering',
    'checks',
    'leases',
    'signing',
  ],
} satisfies Record<string, ModuleId[]>;

export type PresetName = keyof typeof PRESETS;
