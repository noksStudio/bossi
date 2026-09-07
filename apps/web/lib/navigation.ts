import { createRegistry, PLANS, type PlanId } from '@bossi/modules';
import { asPrincipal, currentSubscription, enabledModules, type Principal } from '@bossi/db';
import type { EventDef, NavEntry, SlotContribution, SlotId } from '@bossi/kernel';

/**
 * הניווט נבנה מההרכבה של הדייר, לא מקובץ קבוע.
 *
 * זו הנקודה שבה ארכיטקטורת המודולים הופכת למשהו שרואים: מודול שכבוי
 * פשוט לא קיים בתפריט, ואי אפשר לשכוח להסתיר אותו — כי אף אחד לא
 * כתב אותו שם מלכתחילה.
 */

const registry = createRegistry();

export interface TenantShell {
  tenantName: string;
  modules: string[];
  autoAdded: string[];
  nav: NavEntry[];
  slots: (slot: SlotId) => SlotContribution[];
  /** האירועים שהמודולים הפעילים מכריזים עליהם — ציר הזמן מתרגם דרכם. */
  eventCatalog: EventDef[];
  plan: PlanId;
}

export async function loadShell(principal: Principal): Promise<TenantShell> {
  const { enabled, subscription } = await asPrincipal(principal, async (tx) => ({
    enabled: await enabledModules(tx),
    subscription: await currentSubscription(tx),
  }));

  // דייר בלי מודולים עדיין (רגע אחרי הרשמה) מקבל את מינימום החבילה,
  // כדי שהמסך לא יהיה ריק לגמרי.
  const requested = enabled.length > 0 ? enabled : [...PLANS.starter.modules];
  const composition = registry.resolveTenant(requested);

  return {
    tenantName: principal.tenantName,
    modules: composition.enabled,
    autoAdded: composition.autoAdded,
    nav: composition.nav.filter((n) => (n.realm ?? 'staff') === 'staff'),
    slots: (slot) => composition.slots.get(slot) ?? [],
    eventCatalog: composition.eventCatalog,
    plan: subscription?.plan ?? 'starter',
  };
}

export function moduleName(id: string): string {
  return registry.has(id) ? registry.get(id).name : id;
}

export function moduleOf(contributionId: string): string {
  return contributionId.split('.')[0] ?? '';
}
