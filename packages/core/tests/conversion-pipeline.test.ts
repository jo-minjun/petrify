import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversionPipeline } from '../src/conversion-pipeline.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { ConversionStatePort } from '../src/ports/conversion-state.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';
import type { Note, Stroke } from '../src/models/index.js';

const mockContext = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '' as CanvasLineCap,
  lineJoin: '' as CanvasLineJoin,
  globalAlpha: 1,
};

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 0,
  height: 0,
  toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
    callback(new Blob(['test'], { type: 'image/png' }));
  }),
};

vi.stubGlobal('document', {
  createElement: vi.fn(() => mockCanvas),
});

const testStroke: Stroke = {
  points: [
    { x: 0, y: 0, timestamp: 0 },
    { x: 100, y: 100, timestamp: 1 },
  ],
  color: '#000000',
  width: 2,
  opacity: 100,
};

const mockNote: Note = {
  title: 'Test Note',
  createdAt: new Date('2026-02-03'),
  modifiedAt: new Date('2026-02-03'),
  pages: [{
    id: 'page-1',
    width: 100,
    height: 100,
    strokes: [testStroke],
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
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent();

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(result).toContain('excalidraw-plugin: parsed');
    expect(event.readData).toHaveBeenCalled();
  });

  it('지원하지 않는 확장자면 null을 반환한다', async () => {
    const pipeline = new ConversionPipeline(
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
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
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
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
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ mtime: 1700000000000 });

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(event.readData).toHaveBeenCalled();
  });

  it('OCR 없이 동작한다', async () => {
    const pipeline = new ConversionPipeline(
      [parser], null, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent();

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(result).toContain('excalidraw-plugin: parsed');
  });
});
