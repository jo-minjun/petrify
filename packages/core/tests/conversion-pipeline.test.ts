import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversionPipeline } from '../src/conversion-pipeline.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { ConversionStatePort } from '../src/ports/conversion-state.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';
import type { Note } from '../src/models/index.js';

const mockNote: Note = {
  title: 'Test Note',
  createdAt: new Date('2026-02-03'),
  modifiedAt: new Date('2026-02-03'),
  pages: [{
    id: 'page-1',
    width: 100,
    height: 100,
    imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    order: 0,
  }],
};

function createMockParser(): ParserPort {
  return {
    extensions: ['.note'],
    parse: vi.fn().mockResolvedValue(mockNote),
  };
}

function createMockOcr(): OcrPort {
  return {
    recognize: vi.fn().mockResolvedValue({
      text: '테스트',
      regions: [{ text: '테스트', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
    } satisfies OcrResult),
  };
}

function createEvent(overrides?: Partial<FileChangeEvent>): FileChangeEvent {
  return {
    id: '/path/to/file.note',
    name: 'file.note',
    extension: '.note',
    mtime: 1700000000000,
    readData: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    ...overrides,
  };
}

describe('ConversionPipeline', () => {
  let parser: ParserPort;
  let ocr: OcrPort;
  let conversionState: ConversionStatePort;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = createMockParser();
    ocr = createMockOcr();
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('지원하는 확장자의 파일을 변환한다', async () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent();

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(result).toContain('# Excalidraw Data');
    expect(event.readData).toHaveBeenCalled();
  });

  it('지원하지 않는 확장자면 null을 반환한다', async () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ extension: '.txt', name: 'file.txt' });

    const result = await pipeline.handleFileChange(event);

    expect(result).toBeNull();
    expect(event.readData).not.toHaveBeenCalled();
  });

  it('source mtime이 last converted mtime 이하이면 스킵한다', async () => {
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(1700000000000),
    };
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ mtime: 1700000000000 });

    const result = await pipeline.handleFileChange(event);

    expect(result).toBeNull();
    expect(event.readData).not.toHaveBeenCalled();
  });

  it('source mtime이 last converted mtime보다 크면 변환한다', async () => {
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(1699999999999),
    };
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ mtime: 1700000000000 });

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(event.readData).toHaveBeenCalled();
  });

  it('지원하지 않는 확장자면 스킵 로그를 출력한다', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ extension: '.txt', name: 'file.txt' });

    await pipeline.handleFileChange(event);

    expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Convert] Skipped (unsupported): file.txt');
    consoleSpy.mockRestore();
  });

  it('mtime이 같거나 이전이면 최신 스킵 로그를 출력한다', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(1700000000000),
    };
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ mtime: 1700000000000 });

    await pipeline.handleFileChange(event);

    expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Convert] Skipped (up-to-date): file.note');
    consoleSpy.mockRestore();
  });

  it('OCR 없이 동작한다', async () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]), null, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent();

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(result).toContain('# Excalidraw Data');
  });

  describe('getParsersForExtension', () => {
    it('등록된 확장자의 파서를 반환한다', () => {
      const pipeline = new ConversionPipeline(
        new Map([['.note', parser]]),
        ocr, conversionState, { confidenceThreshold: 50 }
      );

      const result = pipeline.getParsersForExtension('.note');
      expect(result).toEqual([parser]);
    });

    it('등록되지 않은 확장자는 빈 배열을 반환한다', () => {
      const pipeline = new ConversionPipeline(
        new Map([['.note', parser]]),
        ocr, conversionState, { confidenceThreshold: 50 }
      );

      const result = pipeline.getParsersForExtension('.txt');
      expect(result).toEqual([]);
    });

    it('대소문자를 무시하고 조회한다', () => {
      const pipeline = new ConversionPipeline(
        new Map([['.note', parser]]),
        ocr, conversionState, { confidenceThreshold: 50 }
      );

      const result = pipeline.getParsersForExtension('.NOTE');
      expect(result).toEqual([parser]);
    });
  });
});
