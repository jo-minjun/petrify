import { describe, it, expect } from 'vitest';
import { ColorExtractor } from '../src/color-extractor';

interface MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  colorSpace: 'srgb';
}

function createTestImageData(
  width: number,
  height: number,
  fillColor: [number, number, number, number] = [255, 0, 0, 255]
): MockImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillColor[0];
    data[i * 4 + 1] = fillColor[1];
    data[i * 4 + 2] = fillColor[2];
    data[i * 4 + 3] = fillColor[3];
  }
  return { width, height, data, colorSpace: 'srgb' };
}

describe('ColorExtractor', () => {
  describe('getColorAt', () => {
    it('포인트에서 색상 추출', () => {
      const imageData = createTestImageData(10, 10, [255, 0, 0, 255]);
      const extractor = new ColorExtractor(imageData as ImageData);
      const { color, opacity } = extractor.getColorAt(5, 5);
      expect(color).toBe('#ff0000');
      expect(opacity).toBe(255);
    });

    it('투명도 있는 색상 추출', () => {
      const imageData = createTestImageData(10, 10, [0, 180, 250, 100]);
      const extractor = new ColorExtractor(imageData as ImageData);
      const { color, opacity } = extractor.getColorAt(5, 5);
      expect(color).toBe('#00b4fa');
      expect(opacity).toBe(100);
    });

    it('범위 밖은 기본값 반환', () => {
      const imageData = createTestImageData(10, 10);
      const extractor = new ColorExtractor(imageData as ImageData);
      expect(extractor.getColorAt(-1, 5)).toEqual({ color: '#000000', opacity: 255 });
      expect(extractor.getColorAt(100, 5)).toEqual({ color: '#000000', opacity: 255 });
    });
  });

  describe('getWidthAt', () => {
    it('스트로크 굵기 측정', () => {
      // 10x10 이미지, 중앙에 5px 굵기의 수직선
      const imageData = createTestImageData(10, 10, [0, 0, 0, 0]);
      for (let y = 0; y < 10; y++) {
        for (let x = 3; x < 8; x++) {
          const idx = (y * 10 + x) * 4;
          imageData.data[idx] = 0;
          imageData.data[idx + 1] = 0;
          imageData.data[idx + 2] = 0;
          imageData.data[idx + 3] = 255;
        }
      }
      const extractor = new ColorExtractor(imageData as ImageData);
      expect(extractor.getWidthAt(5, 5)).toBe(5);
    });

    it('투명 픽셀에서는 0 반환', () => {
      const imageData = createTestImageData(10, 10, [0, 0, 0, 0]);
      const extractor = new ColorExtractor(imageData as ImageData);
      expect(extractor.getWidthAt(5, 5)).toBe(0);
    });

    it('범위 밖은 0 반환', () => {
      const imageData = createTestImageData(10, 10, [255, 0, 0, 255]);
      const extractor = new ColorExtractor(imageData as ImageData);
      expect(extractor.getWidthAt(-1, 5)).toBe(0);
      expect(extractor.getWidthAt(5, 100)).toBe(0);
    });
  });

  describe('extractStrokeWidth', () => {
    it('빈 포인트는 기본값 1 반환', () => {
      const imageData = createTestImageData(10, 10, [0, 0, 0, 0]);
      const extractor = new ColorExtractor(imageData as ImageData);
      expect(extractor.extractStrokeWidth([])).toBe(1);
    });
  });
});
