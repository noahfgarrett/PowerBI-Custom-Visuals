import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ssm-explorer',
    environment: 'jsdom',
    globals: true,
    css: false,
    pool: 'forks',
    poolOptions: { forks: { maxForks: 1, minForks: 1 } },
    setupFiles: ['../../packages/core/src/__test-utils__/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
