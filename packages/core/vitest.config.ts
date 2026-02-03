import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: false,
  },
  resolve: {
    alias: {
      '@petrify/parser-viwoods': resolve(__dirname, '../parser/viwoods/src/index.ts'),
    },
  },
});
