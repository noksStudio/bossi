import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bossi/kernel', '@bossi/modules', '@bossi/core', '@bossi/db', '@bossi/ai'],
  // pg הוא מודול Node ולא נארז ל-bundle של השרת.
  serverExternalPackages: ['pg'],
  // Next משדר metadata לתוך ה-body לדפדפנים רגילים, ו-Chrome קורא את
  // <link rel="manifest"> רק מה-head — בלי זה האפליקציה לא ניתנת להתקנה.
  // ה-metadata שלנו סטטי, כך ששליחה חוסמת לא עולה דבר.
  htmlLimitedBots: /.*/,
  experimental: { optimizePackageImports: [] },
};

export default config;
