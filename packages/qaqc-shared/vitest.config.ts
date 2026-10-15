import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'qaqc-shared',
    environment: 'jsdom',
    css: false,
    setupFiles: ['../core/src/__test-utils__/setup.ts', './src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
