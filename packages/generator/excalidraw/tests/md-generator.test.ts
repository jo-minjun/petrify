import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import { ExcalidrawMdGenerator } from '../src/md-generator.js';
import type { ExcalidrawData, ExcalidrawElement, ExcalidrawFileEntry } from '../src/excalidraw-generator.js';
import type { OcrTextResult } from '@petrify/core';

describe('ExcalidrawMdGenerator', () => {
  it('올바른 마크다운 구조 생성', () => {
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

  it('데이터가 압축됨', () => {
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

  it('압축 후 해제하면 원본 복원', () => {
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
    expect(match).not.toBeNull();

    const compressed = match![1];
    const decompressed = LZString.decompressFromBase64(compressed);
    const restored = JSON.parse(decompressed!);

    expect(restored).toEqual(originalData);
  });

  it('files 객체가 압축 데이터에 포함됨', () => {
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
    expect(match).not.toBeNull();

    const decompressed = LZString.decompressFromBase64(match![1]);
    const restored = JSON.parse(decompressed!);

    expect(restored.files['file-1']).toEqual(fileEntry);
  });
});

describe('OCR Text Section', () => {
  it('generate()에 OCR 결과 전달하면 ## OCR Text 섹션 포함', () => {
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
      { pageIndex: 0, texts: ['테스트 텍스트'] }
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('## OCR Text');
    expect(md).toContain('<!-- Page 1 -->');
    expect(md).toContain('테스트 텍스트');
    const ocrIndex = md.indexOf('## OCR Text');
    const excalidrawIndex = md.indexOf('# Excalidraw Data');
    expect(ocrIndex).toBeLessThan(excalidrawIndex);
  });

  it('generate()에 OCR 결과 없으면 빈 ## OCR Text 섹션', () => {
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
    expect(md).not.toContain('<!-- Page');
  });

  it('generate()에 빈 OCR 배열이면 빈 ## OCR Text 섹션', () => {
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
    expect(md).not.toContain('<!-- Page');
  });

  it('단일 페이지 OCR 결과가 generate() 출력에 포함', () => {
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
      { pageIndex: 0, texts: ['첫 번째 텍스트', '두 번째 텍스트'] }
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('<!-- Page 1 -->');
    expect(md).toContain('첫 번째 텍스트');
    expect(md).toContain('두 번째 텍스트');
  });

  it('여러 페이지 OCR 결과가 generate() 출력에 포함', () => {
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
      { pageIndex: 0, texts: ['페이지1 텍스트'] },
      { pageIndex: 1, texts: ['페이지2 텍스트A', '페이지2 텍스트B'] }
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('<!-- Page 1 -->');
    expect(md).toContain('페이지1 텍스트');
    expect(md).toContain('<!-- Page 2 -->');
    expect(md).toContain('페이지2 텍스트A');
    expect(md).toContain('페이지2 텍스트B');
  });
});
