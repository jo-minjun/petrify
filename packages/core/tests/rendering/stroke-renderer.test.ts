import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrokeRenderer } from '../../src/rendering/stroke-renderer.js';
import type { Stroke } from '../../src/models/index.js';

// 브라우저 Canvas API 모킹
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

describe('StrokeRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('스트로크를 Canvas에 렌더링', async () => {
    const strokes: Stroke[] = [
      {
        points: [
          { x: 0, y: 0, timestamp: 0 },
          { x: 100, y: 100, timestamp: 1 },
        ],
        color: '#000000',
        width: 2,
        opacity: 100,
      },
    ];

    const renderer = new StrokeRenderer();
    renderer.render(strokes, 200, 200);

    expect(mockContext.beginPath).toHaveBeenCalled();
    expect(mockContext.moveTo).toHaveBeenCalledWith(0, 0);
    expect(mockContext.lineTo).toHaveBeenCalledWith(100, 100);
    expect(mockContext.stroke).toHaveBeenCalled();
  });

  it('스트로크 스타일 적용', async () => {
    const strokes: Stroke[] = [
      {
        points: [
          { x: 0, y: 0, timestamp: 0 },
          { x: 50, y: 50, timestamp: 1 },
        ],
        color: '#FF0000',
        width: 5,
        opacity: 50,
      },
    ];

    const renderer = new StrokeRenderer();
    renderer.render(strokes, 100, 100);

    expect(mockContext.strokeStyle).toBe('#FF0000');
    expect(mockContext.lineWidth).toBe(5);
    expect(mockContext.globalAlpha).toBe(0.5);
  });

  it('toArrayBuffer로 PNG 데이터 반환', async () => {
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
    const buffer = await renderer.toArrayBuffer();

    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });
});
