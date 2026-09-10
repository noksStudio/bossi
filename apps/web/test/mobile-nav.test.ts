import { describe, expect, it } from 'vitest';
import type { NavEntry } from '@bossi/kernel';
import { splitMobileNav } from '../lib/mobile-nav';

/**
 * הפיצול לתפריט התחתון בנייד — פונקציה טהורה, בלי DOM ובלי מסד.
 * הכלל: חמישה יעדים בשורה, לעולם לא יותר.
 */

function entry(id: string): NavEntry {
  return { id, label: id, href: `/${id}` };
}

describe('splitMobileNav', () => {
  it('עד חמישה פריטים — הכול נכנס ישירות, בלי "עוד"', () => {
    const nav = ['a', 'b', 'c', 'd', 'e'].map(entry);
    const { primary, overflow } = splitMobileNav(nav);
    expect(primary).toHaveLength(5);
    expect(overflow).toHaveLength(0);
  });

  it('מעל חמישה — ארבעה הראשונים בשורה, השאר מאחורי "עוד"', () => {
    const nav = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(entry);
    const { primary, overflow } = splitMobileNav(nav);
    expect(primary.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(overflow.map((n) => n.id)).toEqual(['e', 'f', 'g']);
  });

  it('לא ממיינת בעצמה — סומכת על סדר הקלט (הקרנל כבר ממיין לפי order)', () => {
    const nav = ['already-sorted-first', 'second', 'third'].map(entry);
    const { primary, overflow } = splitMobileNav(nav, 2);
    expect(primary.map((n) => n.id)).toEqual(['already-sorted-first']);
    expect(overflow.map((n) => n.id)).toEqual(['second', 'third']);
  });

  it('רשימה ריקה לא זורקת', () => {
    expect(splitMobileNav([])).toEqual({ primary: [], overflow: [] });
  });
});
