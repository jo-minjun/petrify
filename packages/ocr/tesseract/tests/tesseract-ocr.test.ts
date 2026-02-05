import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TesseractOcr } from '../src/tesseract-ocr.js';
import type { OcrPort } from '@petrify/core';

const mockTerminate = vi.fn(() => Promise.resolve());
const mockRecognize = vi.fn();

vi.mock('tesseract.js', () => ({
  default: {
    OEM: { LSTM_ONLY: 1 },
  },
  createWorker: vi.fn(() =>
    Promise.resolve({
      recognize: mockRecognize,
      terminate: mockTerminate,
    })
  ),
}));

describe('TesseractOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognize.mockResolvedValue({
      data: {
        lines: [
          {
            text: '안녕하세요 ',
            confidence: 92,
            bbox: { x0: 10, y0: 20, x1: 110, y1: 50 },
          },
          {
            text: '테스트 ',
            confidence: 30,
            bbox: { x0: 10, y0: 60, x1: 90, y1: 90 },
          },
        ],
      },
    });
  });

  it('OcrPort 인터페이스 구현', () => {
    const ocr: OcrPort = new TesseractOcr();
    expect(ocr.recognize).toBeDefined();
  });

  it('recognize: OcrResult에 올바른 text, confidence, regions 반환', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image);

    expect(result.regions).toHaveLength(2);
    expect(result.regions[0]).toEqual({
      text: '안녕하세요',
      confidence: 92,
      x: 10,
      y: 20,
      width: 100,
      height: 30,
    });
    expect(result.regions[1]).toEqual({
      text: '테스트',
      confidence: 30,
      x: 10,
      y: 60,
      width: 80,
      height: 30,
    });
    expect(result.text).toBe('안녕하세요\n테스트');
    expect(result.confidence).toBe(61);
  });

  it('confidenceThreshold로 낮은 신뢰도 영역 필터링', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image, { confidenceThreshold: 50 });

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].text).toBe('안녕하세요');
    expect(result.text).toBe('안녕하세요');
    expect(result.confidence).toBe(92);
  });

  it('terminate: worker 정리', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);
    await ocr.terminate();

    expect(mockTerminate).toHaveBeenCalledOnce();
  });

  it('기본 lang은 kor+eng', () => {
    const ocr = new TesseractOcr();
    expect((ocr as any)['config'].lang).toBe('kor+eng');
  });

  it('사용자 지정 lang 설정', () => {
    const ocr = new TesseractOcr({ lang: 'eng' });
    expect((ocr as any)['config'].lang).toBe('eng');
  });
});
