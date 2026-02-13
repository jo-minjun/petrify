import type { OcrTextResult } from '@petrify/core';
import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import type {
  ExcalidrawData,
  ExcalidrawElement,
  ExcalidrawFileEntry,
} from '../src/excalidraw-generator.js';
import { ExcalidrawMdGenerator } from '../src/md-generator.js';

describe('ExcalidrawMdGenerator', () => {
  it('generates correct markdown structure', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };

    const md = generator.generate(data);

    expect(md).not.toContain('---');
    expect(md).not.toContain('excalidraw-plugin: parsed');
    expect(md).toContain('# Excalidraw Data');
    expect(md).toContain('## Text Elements');
    expect(md).toContain('## Drawing');
    expect(md).toContain('```compressed-json');
  });

  it('compresses data', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'test', type: 'image' } as ExcalidrawElement],
      appState: {},
      files: {},
    };

    const md = generator.generate(data);

    expect(md).not.toContain('"type": "excalidraw"');
    expect(md).toContain('```compressed-json');
  });

  it('restores original data after decompression', () => {
    const generator = new ExcalidrawMdGenerator();
    const originalData: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'test123', type: 'image', x: 100, y: 200 } as ExcalidrawElement],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };

    const md = generator.generate(originalData);

    const match = md.match(/```compressed-json\n(.+?)\n```/s);
    if (!match) throw new Error('compressed-json block not found');

    const decompressed = LZString.decompressFromBase64(match[1]);
    if (!decompressed) throw new Error('decompression failed');

    expect(JSON.parse(decompressed)).toEqual(originalData);
  });

  it('includes files object in compressed data', () => {
    const generator = new ExcalidrawMdGenerator();
    const fileEntry: ExcalidrawFileEntry = {
      mimeType: 'image/png',
      id: 'file-1',
      dataURL: 'data:image/png;base64,iVBOR',
      created: 1700000000000,
    };
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: { 'file-1': fileEntry },
    };

    const md = generator.generate(data);

    const match = md.match(/```compressed-json\n(.+?)\n```/s);
    if (!match) throw new Error('compressed-json block not found');

    const decompressed = LZString.decompressFromBase64(match[1]);
    if (!decompressed) throw new Error('decompression failed');

    expect(JSON.parse(decompressed).files['file-1']).toEqual(fileEntry);
  });
});

describe('OCR Text Section', () => {
  it('includes ## OCR Text section when OCR results are provided to generate()', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };
    const ocrResults: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['테스트 텍스트'] },
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('## OCR Text');
    expect(md).toContain('<!-- page: page-1 -->');
    expect(md).toContain('테스트 텍스트');
    const ocrIndex = md.indexOf('## OCR Text');
    const excalidrawIndex = md.indexOf('# Excalidraw Data');
    expect(ocrIndex).toBeLessThan(excalidrawIndex);
  });

  it('includes empty ## OCR Text section when no OCR results are provided to generate()', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {},
    };

    const md = generator.generate(data);

    expect(md).toContain('## OCR Text');
    expect(md).not.toContain('<!-- page:');
  });

  it('includes empty ## OCR Text section when OCR results array is empty', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {},
    };

    const md = generator.generate(data, undefined, []);

    expect(md).toContain('## OCR Text');
    expect(md).not.toContain('<!-- page:');
  });

  it('includes single page OCR results in generate() output', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {},
    };
    const ocrResults: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['첫 번째 텍스트', '두 번째 텍스트'] },
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('<!-- page: page-1 -->');
    expect(md).toContain('첫 번째 텍스트');
    expect(md).toContain('두 번째 텍스트');
  });

  it('includes multi-page OCR results in generate() output', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {},
    };
    const ocrResults: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['페이지1 텍스트'] },
      { pageId: 'page-2', pageIndex: 1, texts: ['페이지2 텍스트A', '페이지2 텍스트B'] },
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('<!-- page: page-1 -->');
    expect(md).toContain('페이지1 텍스트');
    expect(md).toContain('<!-- page: page-2 -->');
    expect(md).toContain('페이지2 텍스트A');
    expect(md).toContain('페이지2 텍스트B');
  });
});
