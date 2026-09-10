import { describe, expect, it } from 'vitest';
import { PRESETS } from '@bossi/kernel';
import { createRegistry } from '@bossi/modules';
import { groupSidebarNav } from '../lib/navigation';

/**
 * קיבוץ הסיידבר לפי קטגוריה — נבדק על הרכבה אמיתית מהמרשם, בלי מסד:
 * אין כאן שום דבר תלוי-דייר, רק גזירה מהמודולים הפעילים.
 */

const registry = createRegistry();

describe('groupSidebarNav', () => {
  it('פריטי הליבה תמיד קבוצה ראשונה, בלי כותרת', () => {
    const nav = registry.resolveTenant([...PRESETS.documents]).nav;
    const groups = groupSidebarNav(nav);

    expect(groups[0]?.category).toBeUndefined();
    expect(groups[0]?.label).toBeUndefined();
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['core.dashboard', 'core.customers']);
  });

  it('כל מודול פעיל מופיע בקבוצת הקטגוריה שלו, לפי סדר קבוע', () => {
    const nav = registry.resolveTenant([...PRESETS.full]).nav;
    const groups = groupSidebarNav(nav);

    const categories = groups.map((g) => g.category ?? 'core');
    expect(categories[0]).toBe('core');
    // documents לפני money לפני commerce לפני intelligence — כמו ב-CATEGORY_ORDER.
    const withoutCore = categories.slice(1);
    expect(withoutCore).toEqual([...withoutCore].sort((a, b) =>
      ['documents', 'money', 'commerce', 'intelligence'].indexOf(a as string) -
      ['documents', 'money', 'commerce', 'intelligence'].indexOf(b as string),
    ));
  });

  it('קטגוריה בלי אף מודול פעיל לא מופיעה בכלל — אין קבוצה ריקה', () => {
    // רק מסמכים: אין money/commerce/intelligence בהרכבה הזו.
    const nav = registry.resolveTenant([...PRESETS.documents]).nav;
    const groups = groupSidebarNav(nav);

    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.some((g) => g.category === 'commerce')).toBe(false);
  });

  it('הסדר בתוך קבוצה נשאר כפי שהגיע — לא ממיינת מחדש', () => {
    const nav = registry.resolveTenant([...PRESETS.commerce]).nav;
    const commerceGroup = groupSidebarNav(nav).find((g) => g.category === 'commerce');
    const original = nav.filter((n) => commerceGroup?.items.some((i) => i.id === n.id));

    expect(commerceGroup?.items.map((i) => i.id)).toEqual(original.map((i) => i.id));
  });
});
