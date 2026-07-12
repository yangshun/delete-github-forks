import { defineConfig } from 'tsup';

export default defineConfig({
  banner: {
    js: '#!/usr/bin/env node',
  },
  clean: false,
  entry: ['src/server/cli.ts'],
  format: ['esm'],
  minify: true,
  outDir: 'dist',
  platform: 'node',
  sourcemap: true,
  target: 'node20',
});
