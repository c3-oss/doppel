import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { vitestConfig } from '@c3-oss/config-vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  vitestConfig,
  defineConfig({
    resolve: {
      alias: {
        '@c3-oss/doppel-core': path.resolve(moduleDir, '../../packages/doppel-core/src/index.ts'),
      },
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/bin/**', 'src/**/*.d.ts'],
      },
    },
  }),
)
