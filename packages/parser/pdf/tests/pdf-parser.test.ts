import { InvalidFileFormatError, ParseError } from '@petrify/core';
import { describe, expect, it } from 'vitest';
import { PdfParser } from '../src/pdf-parser.js';

interface MockPdfViewport {
  readonly width: number;
  readonly height: number;
}

interface MockPdfInfo {
  readonly Title?: string;
  readonly CreationDate?: string;
  readonly ModDate?: string;
}

interface MockPdfMetadata {
  readonly info?: MockPdfInfo;
}

interface MockPage {
  getViewport(): MockPdfViewport;
  render(): { promise: Promise<void> };
}

interface MockDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<MockPage>;
  getMetadata(): Promise<MockPdfMetadata>;
}

const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);

describe('PdfParser', () => {
  it('supports .pdf extension', () => {
    const parser = new PdfParser(() => {
      throw new Error('not used');
    });

    expect(parser.extensions).toEqual(['.pdf']);
  });

  it('parses pages and metadata from a PDF document', async () => {
    const parser = new PdfParser(
      () => ({
        promise: Promise.resolve(
          createDocument({
            numPages: 2,
            metadata: {
              info: {
                Title: 'Document Title',
                CreationDate: 'D:20250102123456Z',
                ModDate: "D:20250103010203+09'00'",
              },
            },
          }),
        ),
      }),
      () => createCanvas(PNG_BYTES),
    );

    const note = await parser.parse(new ArrayBuffer(8));

    expect(note.title).toBe('Document Title');
    expect(note.pages).toHaveLength(2);
    expect(note.pages[0]).toMatchObject({
      id: 'page-1',
      order: 0,
      width: 1200,
      height: 1600,
    });
    expect(note.pages[0].imageData).toEqual(PNG_BYTES);
    expect(note.pages[1]).toMatchObject({
      id: 'page-2',
      order: 1,
      width: 1200,
      height: 1600,
    });
    expect(note.createdAt.toISOString()).toBe('2025-01-02T12:34:56.000Z');
    expect(note.modifiedAt.toISOString()).toBe('2025-01-02T16:02:03.000Z');
  });

  it('uses default metadata when metadata parsing fails', async () => {
    const parser = new PdfParser(
      () => ({
        promise: Promise.resolve(
          createDocument({
            numPages: 1,
            metadataError: new Error('metadata unavailable'),
          }),
        ),
      }),
      () => createCanvas(PNG_BYTES),
    );

    const note = await parser.parse(new ArrayBuffer(8));

    expect(note.title).toBe('Untitled');
    expect(note.createdAt).toEqual(new Date(0));
    expect(note.modifiedAt).toEqual(new Date(0));
  });

  it('throws InvalidFileFormatError when PDF loading fails', async () => {
    const parser = new PdfParser(() => ({
      promise: Promise.reject(new Error('invalid pdf')),
    }));

    await expect(parser.parse(new ArrayBuffer(8))).rejects.toThrow(InvalidFileFormatError);
  });

  it('throws ParseError when PDF has no pages', async () => {
    const parser = new PdfParser(
      () => ({
        promise: Promise.resolve(createDocument({ numPages: 0 })),
      }),
      () => createCanvas(PNG_BYTES),
    );

    await expect(parser.parse(new ArrayBuffer(8))).rejects.toThrow(ParseError);
    await expect(parser.parse(new ArrayBuffer(8))).rejects.toThrow('PDF contains no pages');
  });

  it('throws ParseError when page rendering fails', async () => {
    const parser = new PdfParser(
      () => ({
        promise: Promise.resolve(
          createDocument({
            numPages: 1,
            renderError: new Error('render failed'),
          }),
        ),
      }),
      () => createCanvas(PNG_BYTES),
    );

    await expect(parser.parse(new ArrayBuffer(8))).rejects.toThrow(ParseError);
    await expect(parser.parse(new ArrayBuffer(8))).rejects.toThrow('Failed to render page 1');
  });
});

function createDocument(options: {
  numPages: number;
  metadata?: MockPdfMetadata;
  metadataError?: Error;
  renderError?: Error;
}): MockDocument {
  return {
    numPages: options.numPages,
    getPage: async () => createPage(options.renderError),
    getMetadata: async () => {
      if (options.metadataError) {
        throw options.metadataError;
      }
      return options.metadata ?? { info: {} };
    },
  };
}

function createPage(renderError?: Error): MockPage {
  return {
    getViewport: () => ({ width: 1200, height: 1600 }),
    render: () => ({
      promise: renderError ? Promise.reject(renderError) : Promise.resolve(),
    }),
  };
}

function createCanvas(bytes: Uint8Array): {
  getContext(): object;
  toPngBytes(): Promise<Uint8Array>;
} {
  return {
    getContext: () => ({}),
    toPngBytes: async () => bytes,
  };
}
