import type { SlotContribution } from '@bossi/kernel';

/**
 * לשוניות כרטיס הלקוח.
 *
 * המודולים תורמים את הלשוניות דרך slots, אבל לא כולן נבנו עדיין.
 * המפה הזו היא הגשר: לשונית שיש לה מסלול היא קישור, וכל השאר מוצגת
 * מעומעמת עם הסבר — עדיף על לשונית שנראית לחיצה ולא עושה כלום.
 */
const ROUTES: Record<string, (customerId: string) => string> = {
  'checks.tab': (id) => `/customers/${id}/checks`,
  'documents.tab': (id) => `/customers/${id}/documents`,
};

export interface CustomerTab {
  id: string;
  label: string;
  href: string | null;
  moduleId: string;
}

export function customerTabs(
  contributions: SlotContribution[],
  customerId: string,
): CustomerTab[] {
  return contributions.map((c) => ({
    id: c.id,
    label: c.label ?? c.id,
    href: ROUTES[c.id]?.(customerId) ?? null,
    moduleId: c.id.split('.')[0] ?? '',
  }));
}
