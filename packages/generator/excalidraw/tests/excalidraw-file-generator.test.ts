import { describe, it, expect } from 'vitest';
import { ExcalidrawFileGenerator } from '../src/excalidraw-file-generator.js';
import { createPage, createNote } from './helpers.js';

describe('ExcalidrawFileGenerator', () => {
  it('assets에 페이지 이미지가 포함됨', () => {
    const generator = new ExcalidrawFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = generator.generate(note, 'test-note');

    expect(output.assets.size).toBe(1);
    expect(output.assets.get('p1.png')).toEqual(imageData);
  });

  it('content에 embedded files 참조가 포함됨', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'test-note');

    expect(output.content).toContain('p1: [[assets/test-note/p1.png]]');
  });

  it('다중 페이지 시 모든 assets 포함', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([
      createPage({ id: 'p1', order: 0 }),
      createPage({ id: 'p2', order: 1 }),
    ]);
    const output = generator.generate(note, 'my-note');

    expect(output.assets.size).toBe(2);
    expect(output.assets.has('p1.png')).toBe(true);
    expect(output.assets.has('p2.png')).toBe(true);
    expect(output.content).toContain('p1: [[assets/my-note/p1.png]]');
    expect(output.content).toContain('p2: [[assets/my-note/p2.png]]');
  });

  it('OCR 결과가 content에 포함됨', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const ocrResults = [{ pageIndex: 0, texts: ['안녕하세요', '테스트'] }];
    const output = generator.generate(note, 'test', ocrResults);

    expect(output.content).toContain('## OCR Text');
    expect(output.content).toContain('안녕하세요');
    expect(output.content).toContain('테스트');
  });

  it('content에 base64 dataURL이 없음 (외부 에셋 방식)', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const output = generator.generate(note, 'test');

    expect(output.content).not.toContain('data:image/png;base64,');
  });
});
