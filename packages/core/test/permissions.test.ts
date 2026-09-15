import { describe, expect, it } from 'vitest';
import { can, effectivePermissions, isOwnerOnly, OWNER_ONLY } from '../src/index';

describe('הרשאות', () => {
  it('בעלים יכול הכול', () => {
    expect(can('owner', 'checks.mark')).toBe(true);
    expect(can('owner', 'anything.at.all')).toBe(true);
  });

  it('עובד קורא ולא מסמן צ׳קים', () => {
    expect(can('staff', 'checks.read')).toBe(true);
    expect(can('staff', 'checks.mark')).toBe(false);
  });

  it('הנהלת חשבונות מסמנת צ׳קים אבל לא עורכת חוזים', () => {
    expect(can('bookkeeper', 'checks.mark')).toBe(true);
    expect(can('bookkeeper', 'leases.write')).toBe(false);
  });

  it('עקיפה מעניקה הרשאה נקודתית — "למזכירה מותר גם לסמן צ׳קים"', () => {
    expect(can('staff', 'checks.mark', [{ permission: 'checks.mark', granted: true }])).toBe(true);
  });

  it('עקיפה שוללת גוברת גם על בעלים', () => {
    expect(can('owner', 'billing.write', [{ permission: 'billing.write', granted: false }])).toBe(false);
  });

  it('עקיפות אינן דולפות בין תפקידים', () => {
    const withGrant = effectivePermissions('staff', [{ permission: 'checks.mark', granted: true }]);
    const without = effectivePermissions('staff');
    expect(withGrant.has('checks.mark')).toBe(true);
    expect(without.has('checks.mark')).toBe(false);
  });

  it('פעולות הרסניות אינן ניתנות להענקה', () => {
    for (const p of OWNER_ONLY) expect(isOwnerOnly(p)).toBe(true);
    expect(isOwnerOnly('checks.mark')).toBe(false);
  });

  it('מנהל מאשר ויוצר הזמנות — לא רק בעלים', () => {
    expect(can('manager', 'orders.approve')).toBe(true);
    expect(can('manager', 'orders.write')).toBe(true);
  });

  it('"עובד ייצור בלבד" — חריג פר-משתמש, לא תפקיד: staff לא מקבל orders.production כברירת מחדל, ומקבל עם עקיפה', () => {
    expect(can('staff', 'orders.production')).toBe(false);
    expect(can('staff', 'orders.production', [{ permission: 'orders.production', granted: true }])).toBe(true);
    // ובלי שום הרשאת orders אחרת — זו בדיוק הנקודה: הרשאה אחת, לא תפקיד.
    expect(can('staff', 'orders.read', [{ permission: 'orders.production', granted: true }])).toBe(false);
  });
});
