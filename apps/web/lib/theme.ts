export type Theme = 'light' | 'dark' | 'system';
export const THEME_KEY = 'bossi-theme';

/**
 * רץ inline ב-<head> לפני הצביעה הראשונה, כדי שלא תהיה הבזקה של הערכה הלא נכונה.
 * חייב להישאר עצמאי — בלי import, בלי משתנים חיצוניים.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();
