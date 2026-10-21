import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'qaqc-ffu-map',
    environment: 'jsdom',
    css: false,
    setupFiles: ['../core/src/__test-utils__/setup.ts', '../qaqc-shared/src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
