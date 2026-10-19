import { configDefaults, defineConfig } from 'vitest/config';

import { TIMING_TESTS } from './vitest.timing.config';

export default defineConfig({
  test: {
    name: 'qaqc-shared',
    environment: 'jsdom',
    css: false,
    setupFiles: ['../core/src/__test-utils__/setup.ts', './src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // The timing budgets run in the qaqc-shared-timing project (vitest.timing.config.ts), after the rest of the suite.
    exclude: [...configDefaults.exclude, ...TIMING_TESTS],
  },
});
