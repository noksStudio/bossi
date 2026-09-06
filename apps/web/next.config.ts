import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bossi/kernel', '@bossi/modules', '@bossi/db'],
  // pg הוא מודול Node ולא נארז ל-bundle של השרת
  serverExternalPackages: ['pg'],
  experimental: { optimizePackageImports: [] },
};

export default config;
