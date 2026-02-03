import { describe, it, expect, vi } from 'vitest';
import { convertToMdWithOcr } from '../src/api.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { Note } from '../src/models/note.js';

describe('convertToMdWithOcr', () => {
  const mockNote: Note = {
    title: 'Test Note',
    createdAt: new Date('2026-02-03'),
    modifiedAt: new Date('2026-02-03'),
    pages: [
      {
        id: 'page-1',
        width: 100,
        height: 100,
        strokes: [],
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
});

describe('convertToMdWithOcr integration', () => {
  it('생성된 마크다운이 올바른 구조를 가짐', async () => {
    const mockNote: Note = {
      title: 'Test Note',
      createdAt: new Date('2026-02-03'),
      modifiedAt: new Date('2026-02-03'),
      pages: [{ id: 'page-1', width: 100, height: 100, strokes: [] }],
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

    // 구조 검증
    expect(md).toMatch(/^---\nexcalidraw-plugin: parsed/);
    expect(md).toContain('## OCR Text');
    expect(md).toContain('# Excalidraw Data');
    expect(md).toContain('## Text Elements');
    expect(md).toContain('## Drawing');

    // 순서 검증: OCR Text < Excalidraw Data < Text Elements < Drawing
    const ocrIndex = md.indexOf('## OCR Text');
    const dataIndex = md.indexOf('# Excalidraw Data');
    const textIndex = md.indexOf('## Text Elements');
    const drawingIndex = md.indexOf('## Drawing');

    expect(ocrIndex).toBeLessThan(dataIndex);
    expect(dataIndex).toBeLessThan(textIndex);
    expect(textIndex).toBeLessThan(drawingIndex);

    // OCR 텍스트 포함 확인
    expect(md).toContain('안녕하세요');
  });
});
