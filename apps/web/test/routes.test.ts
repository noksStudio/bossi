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

/**
 * שני העולמות אינם מתערבבים.
 *
 * עוגיית צוות תקפה אינה פותחת את `/admin`, ועוגיית אדמין אינה פותחת
 * מסך של דייר. זו הבדיקה שמגנה על כלל 2 בשכבת ה-edge.
 */
describe('הפרדת ריאלמים ב-middleware', () => {
  const STAFF = 'bossi_staff';
  const PLATFORM = 'bossi_platform';

  async function go(path: string, cookie?: string) {
    const { middleware } = await import('../middleware');
    const request = new NextRequest(new URL(`http://localhost${path}`));
    if (cookie) request.cookies.set(cookie, 'x');
    return middleware(request)?.headers.get('location') ?? null;
  }

  it('עוגיית צוות אינה פותחת את הניהול', async () => {
    expect(await go('/admin', STAFF)).toContain('/admin/signin');
    expect(await go('/admin/system', STAFF)).toContain('/admin/signin');
  });

  it('עוגיית אדמין אינה פותחת מסך של דייר', async () => {
    expect(await go('/dashboard', PLATFORM)).toContain('/signin');
    expect(await go('/customers', PLATFORM)).toContain('/signin');
  });

  it('כל אחת פותחת את העולם שלה', async () => {
    expect(await go('/admin', PLATFORM)).toBeNull();
    expect(await go('/dashboard', STAFF)).toBeNull();
  });

  it('מסך ההתחברות לניהול פתוח, שאר הניהול לא', async () => {
    expect(await go('/admin/signin')).toBeNull();
    expect(await go('/api/admin/auth/signin')).toBeNull();
    expect(await go('/admin')).toContain('/admin/signin');
    expect(await go('/api/admin/tenants')).toContain('/admin/signin');
  });

  it('קישור שיתוף וקבצי הדמו שהוא מטמיע פתוחים בלי עוגייה', async () => {
    // באג אמיתי שנתפס כאן: middleware.matcher פוטר רק סיומות תמונה,
    // ו-PDF לא ביניהן — כך שהקובץ המוטמע ב-object של דף השיתוף היה
    // מפנה לדף ההתחברות, ומפיל את כל הצפייה האנונימית.
    expect(await go('/s/some-token')).toBeNull();
    expect(await go('/demo/invoice.pdf')).toBeNull();
  });
});
