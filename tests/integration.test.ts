// tests/integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { convert, convertToMd } from '../src/index';

// Mock ColorExtractor.fromPng since it uses browser APIs
vi.mock('../src/color-extractor', async () => {
  const actual = await vi.importActual('../src/color-extractor');
  return {
    ...actual,
    ColorExtractor: {
      ...(actual as any).ColorExtractor,
      BACKGROUND_COLORS: new Set(['#ffffff', '#fffff0']),
      fromPng: vi.fn().mockResolvedValue({
        getColorAt: () => ({ color: '#000000', opacity: 255 }),
        extractStrokeWidth: () => 6,
      }),
    },
  };
});

describe('Integration', () => {
  it('convert: ArrayBuffer -> ExcalidrawData', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const result = await convert(data.buffer);

    expect(result.type).toBe('excalidraw');
    expect(result.version).toBe(2);
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('convertToMd: ArrayBuffer -> .excalidraw.md string', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const result = await convertToMd(data.buffer);

    expect(result).toContain('excalidraw-plugin: parsed');
    expect(result).toContain('```compressed-json');
  });
});
