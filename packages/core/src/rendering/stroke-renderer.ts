import type { Stroke } from '../models/index.js';

export class StrokeRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  render(strokes: Stroke[], width: number, height: number): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Canvas 2D context를 가져올 수 없습니다');
    }

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      this.renderStroke(stroke);
    }
  }

  private renderStroke(stroke: Stroke): void {
    if (!this.ctx || stroke.points.length === 0) return;

    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.width;
    this.ctx.globalAlpha = stroke.opacity / 100;

    const [first, ...rest] = stroke.points;
    this.ctx.moveTo(first.x, first.y);

    for (const point of rest) {
      this.ctx.lineTo(point.x, point.y);
    }

    this.ctx.stroke();
  }

  async toArrayBuffer(): Promise<ArrayBuffer> {
    if (!this.canvas) {
      throw new Error('render()를 먼저 호출해야 합니다');
    }

    return new Promise((resolve, reject) => {
      this.canvas!.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas를 Blob으로 변환할 수 없습니다'));
          return;
        }
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    });
  }
}
