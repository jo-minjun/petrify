// tests/parser.test.ts
import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { NoteParser } from '../src/parser';
import { ColorExtractor } from '../src/color-extractor';

vi.mock('../src/color-extractor', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/color-extractor')>();

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

describe('NoteParser', () => {
  it('ZIP 파일 파싱', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const parser = new NoteParser();
    const note = await parser.parse(data.buffer);

    expect(note.pages.length).toBeGreaterThan(0);
  });

  it('스트로크가 timestamp gap으로 분리됨', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const parser = new NoteParser();
    const note = await parser.parse(data.buffer);

    const totalStrokes = note.pages.reduce((sum, page) => sum + page.strokes.length, 0);
    expect(totalStrokes).toBeGreaterThan(1);
  });
});
