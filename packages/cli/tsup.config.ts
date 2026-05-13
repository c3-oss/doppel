import { defineConfig } from 'tsup';

export default defineConfig({
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
});
