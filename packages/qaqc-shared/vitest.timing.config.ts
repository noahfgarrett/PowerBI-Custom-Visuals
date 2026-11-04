import { defineConfig } from 'vitest/config';

/** The test files that assert timing budgets. They run in their own project, after every other project. */
export const TIMING_TESTS = [
  'src/__tests__/benchmark.test.ts',
  'src/__tests__/performanceBenchmark.test.ts',
  'src/__tests__/ffuMapBenchmark.test.ts',
  'src/__tests__/rowFiltersBenchmark.test.ts',
];

/**
 * Timing budgets, run once the rest of the suite has finished (`groupOrder: 1`; every other project is in group 0).
 * While the full suite runs, every core stays busy for its whole duration, so a timed call can run slowly on every
 * attempt and best-of-three alone cannot steady it. Run on their own, the budgets measure the code.
 */
export default defineConfig({
  test: {
    name: 'qaqc-shared-timing',
    environment: 'jsdom',
    css: false,
    setupFiles: ['../core/src/__test-utils__/setup.ts', './src/__tests__/setup.ts'],
    include: TIMING_TESTS,
    sequence: { groupOrder: 1 },
  },
});
