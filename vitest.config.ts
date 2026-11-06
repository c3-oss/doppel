import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['apps/server/vitest.config.ts', 'apps/cli/vitest.config.ts', 'packages/doppel-core/vitest.config.ts'],
  },
})
