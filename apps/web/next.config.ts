import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bossi/kernel', '@bossi/modules'],
  experimental: { optimizePackageImports: [] },
};

export default config;
