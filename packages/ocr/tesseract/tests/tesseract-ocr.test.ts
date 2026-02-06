import type { OcrPort } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TesseractOcr } from '../src/tesseract-ocr.js';

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
    }),
  ),
}));

describe('TesseractOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognize.mockResolvedValue({
      data: {
        text: '안녕하세요\n테스트\n',
        confidence: 61,
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
      confidence: 61,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(result.regions[1]).toEqual({
      text: '테스트',
      confidence: 61,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(result.text).toBe('안녕하세요\n테스트');
    expect(result.confidence).toBe(61);
  });

  it('confidenceThreshold로 낮은 신뢰도 영역 필터링', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image, { confidenceThreshold: 70 });

    expect(result.regions).toHaveLength(0);
    expect(result.text).toBe('');
    expect(result.confidence).toBe(61);
  });

  it('terminate: worker 정리', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);
    await ocr.terminate();

    expect(mockTerminate).toHaveBeenCalledOnce();
  });

  it('기본 lang kor+eng로 createWorker 호출', async () => {
    const { createWorker } = await import('tesseract.js');
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);

    expect(createWorker).toHaveBeenCalledWith('kor+eng', expect.anything(), expect.anything());
  });

  it('사용자 지정 lang으로 createWorker 호출', async () => {
    const { createWorker } = await import('tesseract.js');
    const ocr = new TesseractOcr({ lang: 'eng' });
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);

    expect(createWorker).toHaveBeenCalledWith('eng', expect.anything(), expect.anything());
  });
});
