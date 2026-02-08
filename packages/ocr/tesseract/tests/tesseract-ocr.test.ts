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

  it('implements the OcrPort interface', () => {
    const ocr: OcrPort = new TesseractOcr();
    expect(ocr.recognize).toBeDefined();
  });

  it('recognize: returns correct text, confidence, and regions in OcrResult', async () => {
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

  it('filters out low-confidence regions using confidenceThreshold', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image, { confidenceThreshold: 70 });

    expect(result.regions).toHaveLength(0);
    expect(result.text).toBe('');
    expect(result.confidence).toBe(61);
  });

  it('terminate: cleans up worker', async () => {
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);
    await ocr.terminate();

    expect(mockTerminate).toHaveBeenCalledOnce();
  });

  it('calls createWorker with default lang kor+eng', async () => {
    const { createWorker } = await import('tesseract.js');
    const ocr = new TesseractOcr();
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);

    expect(createWorker).toHaveBeenCalledWith('kor+eng', expect.anything(), expect.anything());
  });

  it('calls createWorker with user-specified lang', async () => {
    const { createWorker } = await import('tesseract.js');
    const ocr = new TesseractOcr({ lang: 'eng' });
    const image = new ArrayBuffer(100);

    await ocr.recognize(image);

    expect(createWorker).toHaveBeenCalledWith('eng', expect.anything(), expect.anything());
  });
});
