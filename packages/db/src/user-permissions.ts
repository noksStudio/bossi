import type { PermissionOverride } from '@bossi/core';
import type { Tx } from './client';

/**
 * חריגי הרשאה פר-משתמש (`user_permissions`, 0007).
 *
 * התפקיד הוא ברירת המחדל; זו רשימת החריגים בלבד — למשל "לעובד הזה
 * מותר *רק* לוח ייצור, בלי שום הרשאה אחרת שהתפקיד `staff` נותן
 * כברירת מחדל". הכתיבה נאכפת גם במסד (0007: רק הבעלים כותב), כך
 * שגם אם שכבת האפליקציה תשכח לבדוק — המסד לא יאפשר.
 */

export async function listUserPermissionOverrides(tx: Tx, userId: string): Promise<PermissionOverride[]> {
  const { rows } = await tx.query<PermissionOverride>(
    'select permission, granted from user_permissions where user_id = $1',
    [userId],
  );
  return rows;
}

export async function setUserPermission(
  tx: Tx,
  input: { userId: string; permission: string; granted: boolean },
): Promise<void> {
  await tx.query(
    `insert into user_permissions (tenant_id, user_id, permission, granted)
     values (current_tenant(), $1, $2, $3)
     on conflict (tenant_id, user_id, permission) do update set granted = excluded.granted`,
    [input.userId, input.permission, input.granted],
  );
}

export async function clearUserPermission(tx: Tx, userId: string, permission: string): Promise<void> {
  await tx.query('delete from user_permissions where user_id = $1 and permission = $2', [userId, permission]);
}
