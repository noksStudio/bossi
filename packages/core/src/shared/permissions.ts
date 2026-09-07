/**
 * הרשאות.
 *
 * התפקיד הוא ברירת המחדל, והחריגים הם רשימת עקיפות פר-משתמש. עסק עם
 * ארבעה עובדים לא צריך מטריצת הרשאות מלאה — הוא צריך לומר "למזכירה
 * מותר גם לסמן צ'קים".
 *
 * שים לב: פעולות הרסניות (מחיקת הערה, צ'ק או חוזה) אינן הרשאה שאפשר
 * להעניק. הן נאכפות במסד ושמורות לבעלים בלבד — כי הרשאה שאפשר להעניק
 * בטעות היא הרשאה שתוענק בטעות.
 */

export type Role = 'owner' | 'manager' | 'staff' | 'bookkeeper';

export interface PermissionOverride {
  permission: string;
  granted: boolean;
}

/** `*` = הכול. אחרת רשימה מפורשת. */
const ROLE_GRANTS: Record<Role, string[]> = {
  owner: ['*'],

  manager: [
    'customers.read', 'customers.write',
    'documents.read', 'documents.write', 'documents.review',
    'search.query',
    'notes.read', 'notes.write',
    'checks.read', 'checks.mark',
    'leases.read', 'leases.write',
    'signing.send',
    'billing.read', 'collections.read', 'collections.send',
    'alerts.read',
  ],

  staff: [
    'customers.read',
    'documents.read', 'documents.write',
    'search.query',
    'notes.read', 'notes.write',
    'checks.read',
    'leases.read',
    'alerts.read',
  ],

  bookkeeper: [
    'customers.read',
    'documents.read',
    'search.query',
    'notes.read', 'notes.write',
    'checks.read', 'checks.mark',
    'leases.read',
    'billing.read', 'billing.write',
    'collections.read', 'collections.send',
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'בעלים',
  manager: 'מנהל',
  staff: 'עובד',
  bookkeeper: 'הנהלת חשבונות',
};

export function effectivePermissions(role: Role, overrides: PermissionOverride[] = []): Set<string> {
  const base = new Set(ROLE_GRANTS[role] ?? []);
  for (const o of overrides) {
    if (o.granted) base.add(o.permission);
    else base.delete(o.permission);
  }
  return base;
}

export function can(
  role: Role,
  permission: string,
  overrides: PermissionOverride[] = [],
): boolean {
  const granted = effectivePermissions(role, overrides);
  // עקיפה שוללת גוברת גם על בעלים — אחרת אי אפשר להגביל שותף.
  if (overrides.some((o) => o.permission === permission && !o.granted)) return false;
  return granted.has('*') || granted.has(permission);
}

/** פעולות שאינן ניתנות להענקה. תמיד בעלים בלבד, גם במסד. */
export const OWNER_ONLY = ['notes.delete', 'checks.delete', 'leases.delete', 'permissions.manage'] as const;

export function isOwnerOnly(permission: string): boolean {
  return (OWNER_ONLY as readonly string[]).includes(permission);
}
