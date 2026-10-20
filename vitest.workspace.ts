import { defineWorkspace } from 'vitest/config';
export default defineWorkspace(['packages/*/vitest.config.ts', 'packages/qaqc-shared/vitest.timing.config.ts']);
