import {
  ConversionError,
  type ConversionMetadata,
  type ConversionMetadataPort,
  type FileChangeEvent,
  type FileGeneratorPort,
  type GeneratorOutput,
  type IncrementalInput,
  type Note,
  type OcrPort,
  type OcrResult,
  type OcrTextResult,
  type Page,
  ParseError,
  type ParserPort,
  PetrifyService,
} from '@petrify/core';
import { ExcalidrawFileGenerator } from '@petrify/generator-excalidraw';
import { MarkdownFileGenerator } from '@petrify/generator-markdown';
import { describe, expect, it } from 'vitest';
import { saveConversionResult } from '../src/conversion-saver.js';

class FakeMetadata implements ConversionMetadataPort {
  readonly store = new Map<string, ConversionMetadata>();
  readonly contents = new Map<string, string>();

  getContent(id: string): Promise<string | undefined> {
    return Promise.resolve(this.contents.get(id));
  }

  async getMetadata(id: string): Promise<ConversionMetadata | undefined> {
    return this.store.get(id);
  }

  formatMetadata(metadata: ConversionMetadata): string {
    return `---\nsource: ${metadata.source}\nfileHash: ${metadata.fileHash}\n---\n`;
  }
}

class FakeParser implements ParserPort {
  readonly id = 'fake-parser';
  readonly extensions = ['.note'];
  private readonly noteToReturn: Note;
  private shouldThrow: Error | null = null;

  constructor(note: Note) {
    this.noteToReturn = note;
  }

  setError(error: Error): void {
    this.shouldThrow = error;
  }

  async parse(_data: ArrayBuffer): Promise<Note> {
    if (this.shouldThrow) throw this.shouldThrow;
    return this.noteToReturn;
  }
}

class FakeGenerator implements FileGeneratorPort {
  readonly id = 'fake-generator';
  readonly displayName = 'Fake Generator';
  readonly extension = '.fake.md';

  generate(note: Note, _outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput {
    let content = `# ${note.title}\nPages: ${note.pages.length}\n`;
    if (ocrResults && ocrResults.length > 0) {
      content += '## OCR\n';
      for (const result of ocrResults) {
        content += `Page ${result.pageIndex}: ${result.texts.join(', ')}\n`;
      }
    }

    const assets = new Map<string, Uint8Array>();
    for (const page of note.pages) {
      assets.set(`${page.id}.png`, page.imageData);
    }

    return { content, assets, extension: this.extension };
  }

  incrementalUpdate(_input: IncrementalInput, note: Note, outputName: string): GeneratorOutput {
    return this.generate(note, outputName);
  }
}

class FakeOcr implements OcrPort {
  private readonly results: Map<string, OcrResult> = new Map();
  readonly recognized: string[] = [];

  setResult(imageKey: string, result: OcrResult): void {
    this.results.set(imageKey, result);
  }

  async recognize(image: ArrayBuffer): Promise<OcrResult> {
    const key = new Uint8Array(image).join(',');
    this.recognized.push(key);
    const result = this.results.get(key);
    if (result) return result;

    return {
      text: 'default-ocr-text',
      confidence: 90,
      regions: [{ text: 'default-ocr-text', confidence: 90, x: 0, y: 0, width: 100, height: 20 }],
    };
  }
}

function createPage(overrides?: Partial<Page>): Page {
  return {
    id: 'page-1',
    order: 0,
    width: 100,
    height: 100,
    imageData: new Uint8Array([1, 2, 3]),
    ...overrides,
  };
}

function createNote(overrides?: Partial<Note>): Note {
  return {
    title: 'Test Note',
    pages: [createPage()],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createFileChangeEvent(overrides?: Partial<FileChangeEvent>): FileChangeEvent {
  return {
    id: '/path/to/file.note',
    name: 'file.note',
    extension: '.note',
    readData: async () => new ArrayBuffer(8),
    ...overrides,
  };
}

describe('PetrifyService integration tests (plugin level)', () => {
  for (const generator of [new MarkdownFileGenerator(), new ExcalidrawFileGenerator()]) {
    describe(generator.id, () => {
      for (const hasContent of [true, false]) {
        it(`preserves unchanged page OCR when saved content is ${hasContent ? 'available' : 'missing'}`, async () => {
          const firstPage = createPage();
          const secondPage = createPage({ id: 'page-2', order: 1, imageData: new Uint8Array([4]) });
          const metadata = new FakeMetadata();
          const ocr = new FakeOcr();
          for (const [key, text] of [
            ['1,2,3', 'unchanged-text'],
            ['4', 'old-text'],
            ['5', 'updated-text'],
          ]) {
            ocr.setResult(key, {
              text,
              regions: [{ text, confidence: 90, x: 0, y: 0, width: 10, height: 10 }],
            });
          }
          const service = new PetrifyService(new Map(), generator, ocr, metadata, {
            confidenceThreshold: 50,
          });
          const event = createFileChangeEvent();
          const outputPath = `output/file${generator.extension}`;
          const first = await service.handleFileChange(
            event,
            new FakeParser(createNote({ pages: [firstPage, secondPage] })),
            outputPath,
          );
          if (!first) throw new Error('Initial conversion was skipped');
          metadata.store.set(outputPath, first.metadata);
          if (hasContent) metadata.contents.set(outputPath, first.content);
          const updated = await service.handleFileChange(
            createFileChangeEvent({ readData: () => Promise.resolve(new ArrayBuffer(16)) }),
            new FakeParser(
              createNote({ pages: [firstPage, { ...secondPage, imageData: new Uint8Array([5]) }] }),
            ),
            outputPath,
          );
          expect(updated?.content).toContain('unchanged-text');
          expect(updated?.content).toContain('updated-text');
          expect(updated?.content).not.toContain('old-text');
          expect(ocr.recognized).toHaveLength(hasContent ? 3 : 4);
        });
      }

      it('preserves existing OCR while appending a page, then removes deleted page OCR', async () => {
        const metadata = new FakeMetadata();
        const ocr = new FakeOcr();
        ocr.setResult('4', {
          text: 'added-page-text',
          regions: [{ text: 'added-page-text', confidence: 90, x: 0, y: 0, width: 10, height: 10 }],
        });
        const service = new PetrifyService(new Map(), generator, ocr, metadata, {
          confidenceThreshold: 50,
        });
        const event = createFileChangeEvent();
        const first = await service.handleFileChange(event, new FakeParser(createNote()));
        if (!first) throw new Error('Initial conversion was skipped');
        metadata.store.set(event.id, first.metadata);
        metadata.contents.set(event.id, first.content);
        const secondPage = createPage({ id: 'page-2', order: 1, imageData: new Uint8Array([4]) });
        const appended = await service.handleFileChange(
          createFileChangeEvent({ readData: () => Promise.resolve(new ArrayBuffer(16)) }),
          new FakeParser(createNote({ pages: [createPage(), secondPage] })),
        );
        if (!appended) throw new Error('Append conversion was skipped');
        expect(appended.content).toContain('default-ocr-text');
        expect(appended.content).toContain('added-page-text');
        expect(ocr.recognized).toHaveLength(2);
        metadata.store.set(event.id, appended.metadata);
        metadata.contents.set(event.id, appended.content);
        const removed = await service.handleFileChange(
          createFileChangeEvent({ readData: () => Promise.resolve(new ArrayBuffer(24)) }),
          new FakeParser(createNote({ pages: [{ ...secondPage, order: 0 }] })),
        );
        expect(removed?.content).toContain('added-page-text');
        expect(removed?.content).not.toContain('default-ocr-text');
        expect(removed?.assets.size).toBe(1);
      });

      it('removes old OCR when the changed page has no recognized text', async () => {
        const metadata = new FakeMetadata();
        const ocr = new FakeOcr();
        const service = new PetrifyService(new Map(), generator, ocr, metadata, {
          confidenceThreshold: 50,
        });
        const event = createFileChangeEvent();
        const first = await service.handleFileChange(event, new FakeParser(createNote()));
        if (!first) throw new Error('Initial conversion was skipped');
        metadata.store.set(event.id, first.metadata);
        metadata.contents.set(event.id, first.content);
        ocr.setResult('5', { text: '', regions: [] });
        const updated = await service.handleFileChange(
          createFileChangeEvent({ readData: () => Promise.resolve(new ArrayBuffer(16)) }),
          new FakeParser(createNote({ pages: [createPage({ imageData: new Uint8Array([5]) })] })),
        );
        expect(updated?.content).not.toContain('default-ocr-text');
      });
    });
  }

  it('converts identical source bytes again when the selected parser changes', async () => {
    const metadata = new FakeMetadata();
    const service = new PetrifyService(new Map(), new FakeGenerator(), null, metadata, {
      confidenceThreshold: 50,
    });
    const event = createFileChangeEvent();
    const parser = new FakeParser(createNote());
    const first = await service.handleFileChange(event, parser);
    if (!first) throw new Error('Initial conversion was skipped');
    metadata.store.set(event.id, first.metadata);
    const changedParser: ParserPort = {
      id: 'changed-parser',
      extensions: ['.note'],
      parse: (data) => parser.parse(data),
    };
    const updated = await service.handleFileChange(event, changedParser);
    expect(updated?.metadata.parser).toBe('changed-parser');
    expect(updated?.content).toContain('Test Note');
  });

  it('uses the destination path for metadata lookup and honors keep before reading source data', async () => {
    const metadata = new FakeMetadata();
    metadata.store.set('output/file.md', {
      source: 'remote-id',
      parser: 'fake-parser',
      fileHash: null,
      pageHashes: null,
      keep: true,
    });
    const service = new PetrifyService(new Map(), new FakeGenerator(), null, metadata, {
      confidenceThreshold: 50,
    });
    const result = await service.handleFileChange(
      createFileChangeEvent({
        id: 'remote-id',
        readData: () => Promise.reject(new Error('Source must not be read')),
      }),
      new FakeParser(createNote()),
      'output/file.md',
    );
    expect(result).toBeNull();
  });

  it('retries conversion after an asset write fails without committing new metadata', async () => {
    const metadata = new FakeMetadata();
    const service = new PetrifyService(new Map(), new FakeGenerator(), null, metadata, {
      confidenceThreshold: 50,
    });
    const event = createFileChangeEvent();
    const parser = new FakeParser(createNote());
    const first = await service.handleFileChange(event, parser);
    if (!first) throw new Error('Initial conversion was skipped');
    await expect(
      saveConversionResult(
        first,
        'output',
        'file',
        '.md',
        {
          writeFile: () => {
            metadata.store.set(event.id, first.metadata);
            return Promise.resolve();
          },
          writeAsset: () => Promise.reject(new Error('disk full')),
        },
        metadata,
      ),
    ).rejects.toMatchObject({ phase: 'save' });
    const retry = await service.handleFileChange(event, parser);
    expect(retry).not.toBeNull();
    expect(retry?.assets.size).toBe(1);
    if (!retry) throw new Error('Retry conversion was skipped');
    const savedAssets = new Map<string, Uint8Array>();
    await saveConversionResult(
      retry,
      'output',
      'file',
      '.md',
      {
        writeFile: () => {
          metadata.store.set(event.id, retry.metadata);
          return Promise.resolve();
        },
        writeAsset: (_dir, name, data) => {
          savedAssets.set(name, data);
          return Promise.resolve();
        },
      },
      metadata,
    );
    expect(savedAssets.get('page-1.png')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await service.handleFileChange(event, parser)).toBeNull();
  });

  it('full pipeline: parse -> OCR -> generate', async () => {
    const note = createNote({ title: 'My Note' });
    const fakeParser = new FakeParser(note);
    const fakeOcr = new FakeOcr();
    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();

    const service = new PetrifyService(
      new Map<string, ParserPort>([['.note', fakeParser]]),
      fakeGenerator,
      fakeOcr,
      fakeMetadata,
      { confidenceThreshold: 50 },
    );

    const event = createFileChangeEvent();
    const result = await service.handleFileChange(event, fakeParser);

    expect(result).not.toBeNull();
    expect(result?.content).toContain('My Note');
    expect(result?.content).toContain('default-ocr-text');
    expect(result?.content).toContain('Pages: 1');
  });

  it('OCR confidence filtering is reflected in final output', async () => {
    const page = createPage({ imageData: new Uint8Array([10, 20, 30]) });
    const note = createNote({ pages: [page] });
    const fakeParser = new FakeParser(note);

    const fakeOcr = new FakeOcr();
    const imageKey = new Uint8Array([10, 20, 30]).join(',');
    fakeOcr.setResult(imageKey, {
      text: 'low high',
      confidence: 60,
      regions: [
        { text: 'low', confidence: 30, x: 0, y: 0, width: 50, height: 20 },
        { text: 'high', confidence: 80, x: 0, y: 20, width: 50, height: 20 },
      ],
    });

    const service = new PetrifyService(
      new Map<string, ParserPort>([['.note', fakeParser]]),
      new FakeGenerator(),
      fakeOcr,
      new FakeMetadata(),
      { confidenceThreshold: 50 },
    );

    const result = await service.handleFileChange(createFileChangeEvent(), fakeParser);

    expect(result).not.toBeNull();
    expect(result?.content).toContain('high');
    expect(result?.content).not.toContain('low');
  });

  it('metadata round-trip: skips when fileHash has not changed', async () => {
    const fakeParser = new FakeParser(createNote());
    const fakeMetadata = new FakeMetadata();

    const service = new PetrifyService(
      new Map<string, ParserPort>([['.note', fakeParser]]),
      new FakeGenerator(),
      null,
      fakeMetadata,
      { confidenceThreshold: 50 },
    );

    const event = createFileChangeEvent();
    const firstResult = await service.handleFileChange(event, fakeParser);
    expect(firstResult).not.toBeNull();
    if (firstResult) {
      fakeMetadata.store.set('/path/to/file.note', firstResult.metadata);
    }

    const secondResult = await service.handleFileChange(event, fakeParser);
    expect(secondResult).toBeNull();
  });

  it('stores assets at the correct path', async () => {
    const page = createPage({ id: 'page-abc' });
    const fakeParser = new FakeParser(createNote({ pages: [page] }));

    const service = new PetrifyService(
      new Map<string, ParserPort>([['.note', fakeParser]]),
      new FakeGenerator(),
      null,
      new FakeMetadata(),
      { confidenceThreshold: 50 },
    );

    const result = await service.handleFileChange(createFileChangeEvent(), fakeParser);

    expect(result).not.toBeNull();
    expect(result?.assets.has('page-abc.png')).toBe(true);
    expect(result?.assets.get('page-abc.png')).toEqual(page.imageData);
  });

  it('convertDroppedFile: metadata has keep=true', async () => {
    const fakeParser = new FakeParser(createNote());

    const service = new PetrifyService(new Map(), new FakeGenerator(), null, new FakeMetadata(), {
      confidenceThreshold: 50,
    });

    const result = await service.convertDroppedFile(new ArrayBuffer(8), fakeParser, 'dropped');

    expect(result.content).toContain('Test Note');
    expect(result.metadata.keep).toBe(true);
    expect(result.metadata.source).toBeNull();
  });

  it('handleFileDelete: allows deletion when metadata exists', async () => {
    const fakeMetadata = new FakeMetadata();
    fakeMetadata.store.set('output/file.fake.md', {
      source: '/path/to/file.note',
      parser: null,
      fileHash: null,
      pageHashes: null,
    });

    const service = new PetrifyService(new Map(), new FakeGenerator(), null, fakeMetadata, {
      confidenceThreshold: 50,
    });

    const result = await service.handleFileDelete('output/file.fake.md');
    expect(result).toBe(true);
  });

  it('error propagation chain: parse error is wrapped in ConversionError', async () => {
    const fakeParser = new FakeParser(createNote());
    fakeParser.setError(new ParseError('invalid format'));

    const service = new PetrifyService(
      new Map<string, ParserPort>([['.note', fakeParser]]),
      new FakeGenerator(),
      null,
      new FakeMetadata(),
      { confidenceThreshold: 50 },
    );

    const event = createFileChangeEvent();

    await expect(service.handleFileChange(event, fakeParser)).rejects.toThrow(ConversionError);
    await expect(service.handleFileChange(event, fakeParser)).rejects.toMatchObject({
      phase: 'parse',
    });
  });
});
