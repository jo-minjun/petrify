import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { convert, convertToMd } from '../src/index';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { ColorExtractor } from '../../parser-viwoods/src/color-extractor';

vi.mock('../../parser-viwoods/src/color-extractor', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../parser-viwoods/src/color-extractor')>();

  const MockColorExtractor = class extends original.ColorExtractor {
    static async fromPng(_pngData: ArrayBuffer): Promise<ColorExtractor> {
      const mockData = new Uint8ClampedArray(100 * 100 * 4);
      for (let i = 0; i < mockData.length; i += 4) {
        mockData[i] = 0;
        mockData[i + 1] = 0;
        mockData[i + 2] = 0;
        mockData[i + 3] = 255;
      }
      return new original.ColorExtractor({
        width: 100,
        height: 100,
        data: mockData,
        colorSpace: 'srgb',
      } as ImageData);
    }
  };

  return {
    ...original,
    ColorExtractor: MockColorExtractor,
  };
});

describe('Integration', () => {
  it('convert: ArrayBuffer -> ExcalidrawData', async () => {
    const noteFile = join(__dirname, '../../../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const parser = new ViwoodsParser();
    const result = await convert(data.buffer, parser);

    expect(result.type).toBe('excalidraw');
    expect(result.version).toBe(2);
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('convertToMd: ArrayBuffer -> .excalidraw.md string', async () => {
    const noteFile = join(__dirname, '../../../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const parser = new ViwoodsParser();
    const result = await convertToMd(data.buffer, parser);

    expect(result).toContain('excalidraw-plugin: parsed');
    expect(result).toContain('```compressed-json');
  });
});
