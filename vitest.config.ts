import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    // בדיקות המסד רצות בסדרה — הן בונות ומוחקות את הסכמה.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
