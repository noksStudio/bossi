import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { PRESETS, type NavEntry } from '@bossi/kernel';
import { createRegistry } from '@bossi/modules';

/**
 * הניווט נבנה מהמרשם ולא מקובץ קבוע — וזה בדיוק מה שאיפשר למודול
 * להבטיח מסך שלא נבנה. פריט תפריט שמוביל ל-404 באמצע הדגמה הוא
 * הנזק הגרוע ביותר שהמערכת יכולה לגרום לעצמה.
 *
 * הבדיקה סורקת כל פריט ניווט בכל חבילה, ומוודאת שקיים לו קובץ עמוד.
 * מודול שאין לו מסך פשוט לא יכריז על ניווט.
 */
const APP = join(import.meta.dirname, '..', 'app');

/** `/customers/[id]` → app/(app)/customers/[id]/page.tsx, בכל route group. */
function routeExists(href: string): boolean {
  const segments = href.replace(/^\//, '').split('/').filter(Boolean);
  const candidates = [
    join(APP, ...segments, 'page.tsx'),
    join(APP, '(app)', ...segments, 'page.tsx'),
  ];
  return candidates.some((p) => existsSync(p));
}

const registry = createRegistry();

describe('כל פריט ניווט מוביל למסך קיים', () => {
  const seen = new Map<string, NavEntry>();
  for (const modules of Object.values(PRESETS)) {
    for (const entry of registry.resolveTenant([...modules]).nav) {
      seen.set(entry.href, entry);
    }
  }

  const staff = [...seen.values()].filter((n) => (n.realm ?? 'staff') === 'staff');

  it('נמצאו פריטי ניווט לבדיקה', () => {
    expect(staff.length).toBeGreaterThan(5);
  });

  it.each(staff.map((n) => [n.href, n.label] as const))(
    '%s (%s) — קיים מסך',
    (href) => {
      expect(routeExists(href), `אין קובץ עמוד עבור ${href}`).toBe(true);
    },
  );
});

/**
 * השער הראשון חייב לכסות כל מסך של הצוות.
 *
 * הבדיקה מריצה את ה-middleware האמיתי — לא מעתיקה את הרשימה שלו —
 * ולכן היא נכשלת גם אם מישהו יחזיר אותה להיות רשימת "מה מוגן".
 */
describe('השער הראשון מכסה כל מסך צוות', () => {
  const hrefs = [...new Set(
    Object.values(PRESETS).flatMap((modules) =>
      registry.resolveTenant([...modules]).nav
        .filter((n) => (n.realm ?? 'staff') === 'staff')
        .map((n) => n.href),
    ),
  )];

  it.each(hrefs)('%s — מפנה להתחברות בלי עוגייה', async (href) => {
    const { middleware } = await import('../middleware');
    const request = new NextRequest(new URL(`http://localhost${href}`));
    const response = middleware(request);
    expect(response?.headers.get('location'), `${href} עבר בלי עוגייה`).toContain('/signin');
  });
});
