import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
  },
  resolve: {
    alias: {
      obsidian: new URL('./__mocks__/obsidian.ts', import.meta.url).pathname,
    },
  },
});
