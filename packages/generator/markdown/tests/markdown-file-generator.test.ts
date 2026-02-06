import type { Note, Page } from '@petrify/core';
import { describe, expect, it } from 'vitest';
import { MarkdownFileGenerator } from '../src/markdown-file-generator.js';

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    order: 0,
    width: 1440,
    height: 1920,
    ...overrides,
  };
}

function createNote(pages: Page[]): Note {
  return {
    title: 'Test',
    pages,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

describe('MarkdownFileGenerator', () => {
  it('id와 displayName이 정의됨', () => {
    const generator = new MarkdownFileGenerator();
    expect(generator.id).toBe('markdown');
    expect(generator.displayName).toBe('Markdown');
  });

  it('extension이 .md', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage()]);
    const output = generator.generate(note, 'test-note');
    expect(output.extension).toBe('.md');
  });

  it('assets에 페이지 이미지가 포함됨', () => {
    const generator = new MarkdownFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = generator.generate(note, 'test-note');

    expect(output.assets.size).toBe(1);
    expect(output.assets.get('p1.png')).toEqual(imageData);
  });

  it('OCR 텍스트가 상단에, 이미지가 하단에 배치됨', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const ocrResults = [{ pageIndex: 0, texts: ['안녕하세요'] }];
    const output = generator.generate(note, 'test-note', ocrResults);

    const ocrIndex = output.content.indexOf('안녕하세요');
    const separatorIndex = output.content.indexOf('---');
    const imageIndex = output.content.indexOf('![[');

    expect(ocrIndex).toBeLessThan(separatorIndex);
    expect(separatorIndex).toBeLessThan(imageIndex);
  });

  it('이미지 참조가 assets 경로를 사용', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'my-note');

    expect(output.content).toContain('![[assets/my-note/p1.png]]');
  });

  it('다중 페이지 시 order 순서대로 배치', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([
      createPage({ id: 'p2', order: 1 }),
      createPage({ id: 'p1', order: 0 }),
    ]);
    const output = generator.generate(note, 'test');

    const p1Index = output.content.indexOf('p1.png');
    const p2Index = output.content.indexOf('p2.png');
    expect(p1Index).toBeLessThan(p2Index);
  });

  it('OCR 결과가 없으면 이미지만 출력', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'test');

    expect(output.content).toContain('---');
    expect(output.content).toContain('![[assets/test/p1.png]]');
  });

  it('다중 페이지 OCR이 페이지별로 출력됨', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([
      createPage({ id: 'p1', order: 0 }),
      createPage({ id: 'p2', order: 1 }),
    ]);
    const ocrResults = [
      { pageIndex: 0, texts: ['첫번째 페이지'] },
      { pageIndex: 1, texts: ['두번째 페이지'] },
    ];
    const output = generator.generate(note, 'test', ocrResults);

    expect(output.content).toContain('첫번째 페이지');
    expect(output.content).toContain('두번째 페이지');
  });
});
