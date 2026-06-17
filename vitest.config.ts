import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Resolve workspace packages to their TypeScript source so unit tests run
    // without a prior build step. Production builds still consume `dist`.
    alias: {
      '@typress/config': fromRoot('./packages/config/src/index.ts'),
      '@typress/db': fromRoot('./packages/db/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['{apps,packages}/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
  },
});
