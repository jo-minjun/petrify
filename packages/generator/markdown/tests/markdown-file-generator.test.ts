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
  it('includes page images in assets', () => {
    const generator = new MarkdownFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = generator.generate(note, 'test-note');

    expect(output.assets.size).toBe(1);
    expect(output.assets.get('p1.png')).toEqual(imageData);
  });

  it('places image at the top and OCR text at the bottom', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const ocrResults = [{ pageId: 'p1', pageIndex: 0, texts: ['안녕하세요'] }];
    const output = generator.generate(note, 'test-note', ocrResults);

    const imageIndex = output.content.indexOf('![[');
    const separatorIndex = output.content.indexOf('---');
    const markerIndex = output.content.indexOf('<!-- page: p1 -->');
    const ocrIndex = output.content.indexOf('안녕하세요');

    expect(imageIndex).toBeLessThan(separatorIndex);
    expect(separatorIndex).toBeLessThan(markerIndex);
    expect(markerIndex).toBeLessThan(ocrIndex);
  });

  it('uses assets path for image references', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'my-note');

    expect(output.content).toContain('![[assets/my-note/p1.png]]');
  });

  it('arranges multiple pages in order', () => {
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

  it('outputs only images when there are no OCR results', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'test');

    expect(output.content).toContain('---');
    expect(output.content).toContain('![[assets/test/p1.png]]');
  });

  it('outputs multi-page OCR results per page', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([
      createPage({ id: 'p1', order: 0 }),
      createPage({ id: 'p2', order: 1 }),
    ]);
    const ocrResults = [
      { pageId: 'p1', pageIndex: 0, texts: ['첫번째 페이지'] },
      { pageId: 'p2', pageIndex: 1, texts: ['두번째 페이지'] },
    ];
    const output = generator.generate(note, 'test', ocrResults);

    expect(output.content).toContain('<!-- page: p1 -->');
    expect(output.content).toContain('첫번째 페이지');
    expect(output.content).toContain('<!-- page: p2 -->');
    expect(output.content).toContain('두번째 페이지');
  });
});
