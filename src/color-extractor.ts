export class ColorExtractor {
  static readonly BACKGROUND_COLORS = new Set(['#ffffff', '#fffff0']);
  static readonly OUTLIER_THRESHOLD = 1.5;
  static readonly LOWER_PERCENTILE = 5;

  private readonly width: number;
  private readonly height: number;
  private readonly data: Uint8ClampedArray;

  constructor(imageData: ImageData) {
    this.width = imageData.width;
    this.height = imageData.height;
    this.data = imageData.data;
  }

  static async fromPng(pngData: ArrayBuffer): Promise<ColorExtractor> {
    const blob = new Blob([pngData], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return new ColorExtractor(imageData);
  }

  getColorAt(x: number, y: number): { color: string; opacity: number } {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { color: '#000000', opacity: 255 };
    }

    const idx = (y * this.width + x) * 4;
    const r = this.data[idx];
    const g = this.data[idx + 1];
    const b = this.data[idx + 2];
    const a = this.data[idx + 3];

    const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { color, opacity: a };
  }

  getWidthAt(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return 0;
    }

    const idx = (y * this.width + x) * 4;
    if (this.data[idx + 3] === 0) {
      return 0;
    }

    // 수직 측정
    let vWidth = 1;
    for (const dy of [-1, 1]) {
      let cy = y + dy;
      while (cy >= 0 && cy < this.height) {
        const i = (cy * this.width + x) * 4;
        if (this.data[i + 3] === 0) break;
        vWidth++;
        cy += dy;
      }
    }

    // 수평 측정
    let hWidth = 1;
    for (const dx of [-1, 1]) {
      let cx = x + dx;
      while (cx >= 0 && cx < this.width) {
        const i = (y * this.width + cx) * 4;
        if (this.data[i + 3] === 0) break;
        hWidth++;
        cx += dx;
      }
    }

    return Math.min(vWidth, hWidth);
  }

  extractStrokeWidth(points: number[][]): number {
    const widths: number[] = [];
    for (const point of points) {
      const w = this.getWidthAt(Math.floor(point[0]), Math.floor(point[1]));
      if (w > 0) widths.push(w);
    }

    if (widths.length === 0) return 1;

    const filtered = this.filterOutliers(widths.sort((a, b) => a - b));
    const idx = Math.floor(filtered.length / ColorExtractor.LOWER_PERCENTILE);
    return filtered[idx];
  }

  private filterOutliers(sortedWidths: number[]): number[] {
    if (sortedWidths.length <= 1) return sortedWidths;

    const filtered = [sortedWidths[0]];
    for (let i = 1; i < sortedWidths.length; i++) {
      if (sortedWidths[i] > sortedWidths[i - 1] * ColorExtractor.OUTLIER_THRESHOLD) {
        break;
      }
      filtered.push(sortedWidths[i]);
    }
    return filtered;
  }
}
