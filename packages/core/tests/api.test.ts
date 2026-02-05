import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertToMdWithOcr } from '../src/api.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { Note } from '../src/models/note.js';

describe('convertToMdWithOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNote: Note = {
    title: 'Test Note',
    createdAt: new Date('2026-02-03'),
    modifiedAt: new Date('2026-02-03'),
    pages: [
      {
        id: 'page-1',
        width: 100,
        height: 100,
        imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        order: 0,
      },
    ],
  };

  const mockParser: ParserPort = {
    extensions: ['.note'],
    parse: vi.fn().mockResolvedValue(mockNote),
  };

  const mockOcrResult: OcrResult = {
    text: '테스트 텍스트',
    confidence: 80,
    regions: [
      { text: '테스트', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '텍스트', x: 20, y: 0, width: 10, height: 10, confidence: 90 },
    ],
  };

  const mockOcr: OcrPort = {
    recognize: vi.fn().mockResolvedValue(mockOcrResult),
  };

  it('OCR 결과가 ## OCR Text 섹션에 포함됨', async () => {
    const result = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      mockOcr
    );

    expect(result).toContain('## OCR Text');
    expect(result).toContain('테스트');
    expect(result).toContain('텍스트');
  });

  it('confidence 임계값 적용', async () => {
    const ocrWithLowConfidence: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '혼합',
        regions: [
          { text: '높음', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
          { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
        ],
      }),
    };

    const result = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      ocrWithLowConfidence,
      { ocrConfidenceThreshold: 50 }
    );

    expect(result).toContain('높음');
    expect(result).not.toContain('낮음');
  });

  it('기본 confidence 임계값은 50', async () => {
    const ocrWithLowConfidence: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '혼합',
        regions: [
          { text: '경계', x: 0, y: 0, width: 10, height: 10, confidence: 50 },
          { text: '미만', x: 0, y: 0, width: 10, height: 10, confidence: 49 },
        ],
      }),
    };

    const result = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      ocrWithLowConfidence
    );

    expect(result).toContain('경계');
    expect(result).not.toContain('미만');
  });

  it('OCR에 imageData가 ArrayBuffer로 직접 전달됨', async () => {
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const noteWithImage: Note = {
      title: 'Test',
      createdAt: new Date('2026-02-03'),
      modifiedAt: new Date('2026-02-03'),
      pages: [{
        id: 'page-1',
        width: 100,
        height: 100,
        imageData: imageBytes,
        order: 0,
      }],
    };

    const parser: ParserPort = {
      extensions: ['.note'],
      parse: vi.fn().mockResolvedValue(noteWithImage),
    };

    const ocrSpy: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '',
        regions: [],
      }),
    };

    await convertToMdWithOcr(new ArrayBuffer(0), parser, ocrSpy);

    expect(ocrSpy.recognize).toHaveBeenCalledOnce();
    const passedBuffer = (ocrSpy.recognize as ReturnType<typeof vi.fn>).mock.calls[0][0] as ArrayBuffer;
    expect(passedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(passedBuffer)).toEqual(imageBytes);
  });

  it('다중 페이지 OCR 결과가 모두 포함됨', async () => {
    const multiPageNote: Note = {
      title: 'Multi Page',
      createdAt: new Date('2026-02-03'),
      modifiedAt: new Date('2026-02-03'),
      pages: [
        {
          id: 'page-1',
          width: 100,
          height: 100,
          imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          order: 0,
        },
        {
          id: 'page-2',
          width: 100,
          height: 100,
          imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x48]),
          order: 1,
        },
        {
          id: 'page-3',
          width: 100,
          height: 100,
          imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x49]),
          order: 2,
        },
      ],
    };

    const parser: ParserPort = {
      extensions: ['.note'],
      parse: vi.fn().mockResolvedValue(multiPageNote),
    };

    const ocr: OcrPort = {
      recognize: vi.fn()
        .mockResolvedValueOnce({
          text: '첫번째',
          regions: [{ text: '페이지1 텍스트', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
        })
        .mockResolvedValueOnce({
          text: '두번째',
          regions: [{ text: '페이지2 텍스트', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
        })
        .mockResolvedValueOnce({
          text: '세번째',
          regions: [{ text: '페이지3 텍스트', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
        }),
    };

    const result = await convertToMdWithOcr(new ArrayBuffer(0), parser, ocr);

    expect(ocr.recognize).toHaveBeenCalledTimes(3);
    expect(result).toContain('페이지1 텍스트');
    expect(result).toContain('페이지2 텍스트');
    expect(result).toContain('페이지3 텍스트');
    expect(result).toContain('<!-- Page 1 -->');
    expect(result).toContain('<!-- Page 2 -->');
    expect(result).toContain('<!-- Page 3 -->');
  });

  it('imageData가 빈 페이지는 OCR을 스킵함', async () => {
    const noteWithEmptyPage: Note = {
      title: 'Mixed Pages',
      createdAt: new Date('2026-02-03'),
      modifiedAt: new Date('2026-02-03'),
      pages: [
        {
          id: 'page-1',
          width: 100,
          height: 100,
          imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          order: 0,
        },
        {
          id: 'page-2',
          width: 100,
          height: 100,
          imageData: new Uint8Array([]),
          order: 1,
        },
      ],
    };

    const parser: ParserPort = {
      extensions: ['.note'],
      parse: vi.fn().mockResolvedValue(noteWithEmptyPage),
    };

    const ocr: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '첫번째만',
        regions: [{ text: '텍스트', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
      }),
    };

    await convertToMdWithOcr(new ArrayBuffer(0), parser, ocr);

    expect(ocr.recognize).toHaveBeenCalledOnce();
  });
});

describe('convertToMdWithOcr integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('생성된 마크다운이 올바른 구조를 가짐', async () => {
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

    const mockParser: ParserPort = {
      extensions: ['.note'],
      parse: vi.fn().mockResolvedValue(mockNote),
    };

    const mockOcr: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '테스트',
        regions: [
          { text: '안녕하세요', x: 0, y: 0, width: 10, height: 10, confidence: 90 },
        ],
      }),
    };

    const md = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      mockOcr
    );

    expect(md).not.toContain('excalidraw-plugin: parsed');
    expect(md).toContain('## OCR Text');
    expect(md).toContain('# Excalidraw Data');
    expect(md).toContain('## Text Elements');
    expect(md).toContain('## Drawing');

    const ocrIndex = md.indexOf('## OCR Text');
    const dataIndex = md.indexOf('# Excalidraw Data');
    const textIndex = md.indexOf('## Text Elements');
    const drawingIndex = md.indexOf('## Drawing');

    expect(ocrIndex).toBeLessThan(dataIndex);
    expect(dataIndex).toBeLessThan(textIndex);
    expect(textIndex).toBeLessThan(drawingIndex);

    expect(md).toContain('안녕하세요');
  });
});
