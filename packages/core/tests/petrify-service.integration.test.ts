import { describe, expect, it } from 'vitest';
import { ConversionError, ParseError } from '../src/exceptions.js';
import type { Note, Page } from '../src/models/index.js';
import { PetrifyService } from '../src/petrify-service.js';
import type {
  ConversionMetadata,
  ConversionMetadataPort,
} from '../src/ports/conversion-metadata.js';
import type {
  FileGeneratorPort,
  GeneratorOutput,
  OcrTextResult,
} from '../src/ports/file-generator.js';
import type { FileSystemPort } from '../src/ports/file-system.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';

// --- Lightweight Fake 구현 ---

class FakeFileSystem implements FileSystemPort {
  readonly files = new Map<string, string>();
  readonly assets = new Map<string, Uint8Array>();

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async writeAsset(dir: string, name: string, data: Uint8Array): Promise<string> {
    const path = `${dir}/${name}`;
    this.assets.set(path, data);
    return path;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

class FakeMetadata implements ConversionMetadataPort {
  readonly store = new Map<string, ConversionMetadata>();

  async getMetadata(id: string): Promise<ConversionMetadata | undefined> {
    return this.store.get(id);
  }

  formatMetadata(metadata: ConversionMetadata): string {
    return `---\nsource: ${metadata.source}\nmtime: ${metadata.mtime}\n---\n`;
  }
}

class FakeParser implements ParserPort {
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

// --- 헬퍼 ---

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
    mtime: 2000,
    readData: async () => new ArrayBuffer(8),
    ...overrides,
  };
}

// --- 테스트 ---

describe('PetrifyService 통합 테스트', () => {
  it('전체 파이프라인: parse → OCR → generate → save', async () => {
    const note = createNote({ title: 'My Note' });
    const fakeParser = new FakeParser(note);
    const fakeOcr = new FakeOcr();
    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();
    const fakeFs = new FakeFileSystem();

    const parsers = new Map<string, ParserPort>([['.note', fakeParser]]);
    const service = new PetrifyService(parsers, fakeGenerator, fakeOcr, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const event = createFileChangeEvent();
    const result = await service.handleFileChange(event, 'output');

    expect(result).toBe('output/file.fake.md');

    const savedContent = fakeFs.files.get('output/file.fake.md');
    expect(savedContent).toBeDefined();
    expect(savedContent).toContain('My Note');
    expect(savedContent).toContain('default-ocr-text');
    expect(savedContent).toContain('Pages: 1');
  });

  it('OCR confidence 필터링이 최종 출력에 반영', async () => {
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

    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();
    const fakeFs = new FakeFileSystem();

    const parsers = new Map<string, ParserPort>([['.note', fakeParser]]);
    const service = new PetrifyService(parsers, fakeGenerator, fakeOcr, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const event = createFileChangeEvent();
    await service.handleFileChange(event, 'output');

    const savedContent = fakeFs.files.get('output/file.fake.md')!;
    expect(savedContent).toContain('high');
    expect(savedContent).not.toContain('low');
  });

  it('메타데이터 라운드트립: mtime 변경 없으면 스킵', async () => {
    const note = createNote();
    const fakeParser = new FakeParser(note);
    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();
    const fakeFs = new FakeFileSystem();

    const parsers = new Map<string, ParserPort>([['.note', fakeParser]]);
    const service = new PetrifyService(parsers, fakeGenerator, null, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const event = createFileChangeEvent({ mtime: 1000 });

    const firstResult = await service.handleFileChange(event, 'output');
    expect(firstResult).toBe('output/file.fake.md');

    fakeMetadata.store.set('/path/to/file.note', { source: '/path/to/file.note', mtime: 1000 });

    const secondResult = await service.handleFileChange(event, 'output');
    expect(secondResult).toBeNull();
  });

  it('에셋이 올바른 경로에 저장', async () => {
    const page = createPage({ id: 'page-abc' });
    const note = createNote({ pages: [page] });
    const fakeParser = new FakeParser(note);
    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();
    const fakeFs = new FakeFileSystem();

    const parsers = new Map<string, ParserPort>([['.note', fakeParser]]);
    const service = new PetrifyService(parsers, fakeGenerator, null, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const event = createFileChangeEvent();
    await service.handleFileChange(event, 'output');

    expect(fakeFs.assets.has('output/assets/file/page-abc.png')).toBe(true);
    expect(fakeFs.assets.get('output/assets/file/page-abc.png')).toEqual(page.imageData);
  });

  it('convertDroppedFile: metadata에 keep=true', async () => {
    const note = createNote();
    const fakeParser = new FakeParser(note);
    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();
    const fakeFs = new FakeFileSystem();

    const service = new PetrifyService(new Map(), fakeGenerator, null, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const data = new ArrayBuffer(8);
    const result = await service.convertDroppedFile(data, fakeParser, 'output', 'dropped');

    expect(result).toBe('output/dropped.fake.md');
    expect(fakeFs.files.has('output/dropped.fake.md')).toBe(true);

    const savedContent = fakeFs.files.get('output/dropped.fake.md')!;
    expect(savedContent).toContain('source: null');
  });

  it('handleFileDelete: 메타데이터 있으면 삭제 허용', async () => {
    const fakeMetadata = new FakeMetadata();
    fakeMetadata.store.set('output/file.fake.md', {
      source: '/path/to/file.note',
      mtime: 1000,
    });

    const fakeFs = new FakeFileSystem();
    const service = new PetrifyService(new Map(), new FakeGenerator(), null, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const result = await service.handleFileDelete('output/file.fake.md');
    expect(result).toBe(true);
  });

  it('에러 전파 체인: parse 에러 → ConversionError 래핑', async () => {
    const note = createNote();
    const fakeParser = new FakeParser(note);
    fakeParser.setError(new ParseError('invalid format'));

    const fakeGenerator = new FakeGenerator();
    const fakeMetadata = new FakeMetadata();
    const fakeFs = new FakeFileSystem();

    const parsers = new Map<string, ParserPort>([['.note', fakeParser]]);
    const service = new PetrifyService(parsers, fakeGenerator, null, fakeMetadata, fakeFs, {
      confidenceThreshold: 50,
    });

    const event = createFileChangeEvent();

    await expect(service.handleFileChange(event, 'output')).rejects.toThrow(ConversionError);
    await expect(service.handleFileChange(event, 'output')).rejects.toMatchObject({
      phase: 'parse',
    });
  });
});
