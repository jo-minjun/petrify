import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@petrify/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@petrify/parser-viwoods': path.resolve(__dirname, 'packages/parser/viwoods/src/index.ts'),
      '@petrify/parser-supernote-x': path.resolve(
        __dirname,
        'packages/parser/supernote-x/src/index.ts',
      ),
      '@petrify/ocr-tesseract': path.resolve(__dirname, 'packages/ocr/tesseract/src/index.ts'),
      '@petrify/ocr-google-vision': path.resolve(
        __dirname,
        'packages/ocr/google-vision/src/index.ts',
      ),
      '@petrify/watcher-chokidar': path.resolve(
        __dirname,
        'packages/watcher/chokidar/src/index.ts',
      ),
      '@petrify/watcher-google-drive': path.resolve(
        __dirname,
        'packages/watcher/google-drive/src/index.ts',
      ),
      '@petrify/generator-excalidraw': path.resolve(
        __dirname,
        'packages/generator/excalidraw/src/index.ts',
      ),
      '@petrify/generator-markdown': path.resolve(
        __dirname,
        'packages/generator/markdown/src/index.ts',
      ),
      obsidian: path.resolve(__dirname, 'packages/obsidian-plugin/tests/__mocks__/obsidian.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['**/tests/**/*.test.ts'],
  },
});
