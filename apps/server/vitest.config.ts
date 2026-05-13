import { vitestConfig } from '@c3-oss/config-vitest'
import { mergeConfig } from 'vitest/config'
import { defineConfig } from 'vitest/config'

export default mergeConfig(
  vitestConfig,
  defineConfig({
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
