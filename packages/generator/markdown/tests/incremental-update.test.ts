import type { IncrementalInput, Note, OcrTextResult, Page } from '@petrify/core';
import { describe, expect, it } from 'vitest';
import { MarkdownFileGenerator } from '../src/markdown-file-generator.js';

function createPage(id: string, order: number, imageData?: Uint8Array): Page {
  return {
    id,
    imageData: imageData ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47, order]),
    order,
    width: 1440,
    height: 1920,
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

describe('MarkdownFileGenerator.incrementalUpdate', () => {
  it('reuses OCR text for unchanged pages', () => {
    const generator = new MarkdownFileGenerator();

    const page1 = createPage('page-1', 0);
    const page2 = createPage('page-2', 1);
    const initialNote = createNote([page1, page2]);
    const initialOcr: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['Page 1 text'] },
      { pageId: 'page-2', pageIndex: 1, texts: ['Page 2 text'] },
    ];
    const initialOutput = generator.generate(initialNote, 'test', initialOcr);

    // Update page-2 only
    const newPage2 = createPage('page-2', 1, new Uint8Array([1, 2, 3]));
    const updatedNote = createNote([page1, newPage2]);
    const newOcr: OcrTextResult = { pageId: 'page-2', pageIndex: 1, texts: ['Updated text'] };

    const input: IncrementalInput = {
      existingContent: initialOutput.content,
      existingAssets: initialOutput.assets,
      updates: new Map([['page-2', { page: newPage2, ocrResult: newOcr }]]),
      removedPageIds: [],
    };

    const result = generator.incrementalUpdate(input, updatedNote, 'test');

    expect(result.content).toContain('Page 1 text');
    expect(result.content).toContain('Updated text');
    expect(result.content).not.toContain('Page 2 text');
  });

  it('handles page addition', () => {
    const generator = new MarkdownFileGenerator();

    const page1 = createPage('page-1', 0);
    const initialNote = createNote([page1]);
    const initialOcr: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['Page 1 text'] },
    ];
    const initialOutput = generator.generate(initialNote, 'test', initialOcr);

    const page2 = createPage('page-2', 1);
    const updatedNote = createNote([page1, page2]);
    const newOcr: OcrTextResult = { pageId: 'page-2', pageIndex: 1, texts: ['New page'] };

    const input: IncrementalInput = {
      existingContent: initialOutput.content,
      existingAssets: initialOutput.assets,
      updates: new Map([['page-2', { page: page2, ocrResult: newOcr }]]),
      removedPageIds: [],
    };

    const result = generator.incrementalUpdate(input, updatedNote, 'test');

    expect(result.content).toContain('page-1.png');
    expect(result.content).toContain('page-2.png');
    expect(result.content).toContain('Page 1 text');
    expect(result.content).toContain('New page');
    expect(result.assets.size).toBe(2);
  });

  it('handles page removal', () => {
    const generator = new MarkdownFileGenerator();

    const page1 = createPage('page-1', 0);
    const page2 = createPage('page-2', 1);
    const initialNote = createNote([page1, page2]);
    const initialOcr: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['Page 1 text'] },
      { pageId: 'page-2', pageIndex: 1, texts: ['Page 2 text'] },
    ];
    const initialOutput = generator.generate(initialNote, 'test', initialOcr);

    const updatedNote = createNote([page1]);

    const input: IncrementalInput = {
      existingContent: initialOutput.content,
      existingAssets: initialOutput.assets,
      updates: new Map(),
      removedPageIds: ['page-2'],
    };

    const result = generator.incrementalUpdate(input, updatedNote, 'test');

    expect(result.content).toContain('Page 1 text');
    expect(result.content).not.toContain('Page 2 text');
    expect(result.content).not.toContain('page-2.png');
    expect(result.assets.size).toBe(1);
  });
});
