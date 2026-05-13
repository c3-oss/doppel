import { vitestConfig } from '@c3-oss/config-vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
      },
    },
  }),
)
