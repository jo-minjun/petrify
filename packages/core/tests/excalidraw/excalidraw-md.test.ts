import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import { ExcalidrawMdGenerator } from '../../src/excalidraw';
import type { ExcalidrawData } from '../../src/excalidraw';

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

    expect(md).toContain('---');
    expect(md).toContain('excalidraw-plugin: parsed');
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
      elements: [{ id: 'test', type: 'freedraw' } as any],
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
      elements: [{ id: 'test123', type: 'freedraw', x: 100, y: 200 } as any],
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
});
