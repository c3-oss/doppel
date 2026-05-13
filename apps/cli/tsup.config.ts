import { configBase } from '@c3-oss/config-tsup'
import { type Options, defineConfig } from 'tsup'

export default defineConfig({
  ...(configBase as Options),
  entry: {
    index: 'src/index.ts',
    'bin/doppel': 'src/bin/doppel.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
})
