import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GutenyeOcr } from '../src/gutenye-ocr.js';
import { StrokeRenderer } from '../src/stroke-renderer.js';
import type { Stroke } from '@petrify/core';

// Canvas 모킹
const mockContext = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
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

// OCR 모킹
vi.mock('@gutenye/ocr-browser', () => ({
  default: {
    create: vi.fn(() =>
      Promise.resolve({
        detect: vi.fn(() =>
          Promise.resolve([
            {
              text: '테스트 텍스트',
              mean: 0.9,
              box: [[10, 10], [200, 10], [200, 50], [10, 50]],
            },
          ])
        ),
      })
    ),
  },
}));

describe('통합 테스트: 스트로크 → OCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('스트로크를 렌더링하고 OCR 수행', async () => {
    const strokes: Stroke[] = [
      {
        points: [
          { x: 10, y: 10, timestamp: 0 },
          { x: 100, y: 10, timestamp: 1 },
          { x: 100, y: 50, timestamp: 2 },
        ],
        color: '#000000',
        width: 2,
        opacity: 100,
      },
    ];

    // 1. 스트로크 렌더링
    const renderer = new StrokeRenderer();
    renderer.render(strokes, 300, 100);
    const imageBuffer = await renderer.toArrayBuffer();

    // 2. OCR 수행
    const ocr = await GutenyeOcr.create();
    const result = await ocr.recognize(imageBuffer);

    // 3. 결과 확인
    expect(result.text).toBe('테스트 텍스트');
    expect(result.regions.length).toBe(1);
    expect(result.regions[0].confidence).toBe(90);  // 0.9 * 100
  });

  it('confidence 낮은 결과 필터링', async () => {
    const strokes: Stroke[] = [
      {
        points: [{ x: 0, y: 0, timestamp: 0 }],
        color: '#000000',
        width: 1,
        opacity: 100,
      },
    ];

    const renderer = new StrokeRenderer();
    renderer.render(strokes, 100, 100);
    const imageBuffer = await renderer.toArrayBuffer();

    const ocr = await GutenyeOcr.create();
    const result = await ocr.recognize(imageBuffer, { confidenceThreshold: 95 });

    // confidence 90 < 95 이므로 필터링됨
    expect(result.regions.length).toBe(0);
  });
});
