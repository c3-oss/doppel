import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/server/vitest.config.ts',
  'apps/cli/vitest.config.ts',
  'packages/doppel-core/vitest.config.ts',
]);
