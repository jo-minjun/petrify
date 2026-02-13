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
import { describe, expect, it } from 'vitest';

class FakeMetadata implements ConversionMetadataPort {
  readonly store = new Map<string, ConversionMetadata>();

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

  setResult(imageKey: string, result: OcrResult): void {
    this.results.set(imageKey, result);
  }

  async recognize(image: ArrayBuffer): Promise<OcrResult> {
    const key = new Uint8Array(image).join(',');
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
