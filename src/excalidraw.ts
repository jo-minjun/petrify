// src/excalidraw.ts
import type { Note, Page, Stroke } from '@petrify/core';

export interface ExcalidrawElement {
  type: string;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  angle: number;
  points: number[][];
  pressures: number[];
  simulatePressure: boolean;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: string[];
  frameId: null;
  boundElements: null;
  updated: number;
  link: null;
  locked: boolean;
}

export interface ExcalidrawData {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export class ExcalidrawGenerator {
  static readonly PAGE_GAP = 100;
  static readonly STROKE_WIDTH_DIVISOR = 6;
  static readonly MIN_STROKE_WIDTH = 1;
  // 실험적으로 결정된 값: Excalidraw에서 일정한 획 굵기를 위해 사용
  private static readonly PRESSURE_VALUE = 0.5;
  private static readonly MAX_SEED = 2147483647;

  generate(note: Note): ExcalidrawData {
    let yOffset = 0;
    const elements = note.pages.flatMap((page) => {
      const pageElements = this.generatePageElements(page, yOffset);
      yOffset += page.height + ExcalidrawGenerator.PAGE_GAP;
      return pageElements;
    });

    return {
      type: 'excalidraw',
      version: 2,
      source: 'petrify-converter',
      elements,
      appState: {
        gridSize: null,
        viewBackgroundColor: '#ffffff',
      },
      files: {},
    };
  }

  private generatePageElements(page: Page, yOffset: number): ExcalidrawElement[] {
    return page.strokes.map((stroke) => this.createFreedraw(stroke, yOffset));
  }

  createFreedraw(stroke: Stroke, yOffset: number): ExcalidrawElement {
    if (stroke.points.length === 0) {
      return this.createFreedrawElement(0, yOffset, [], 0, 0, stroke);
    }

    const firstPoint = stroke.points[0];
    const x = firstPoint.x;
    const y = firstPoint.y + yOffset;
    const points = stroke.points.map((p) => [p.x - firstPoint.x, p.y - firstPoint.y]);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    return this.createFreedrawElement(x, y, points, width, height, stroke);
  }

  private createFreedrawElement(
    x: number,
    y: number,
    points: number[][],
    width: number,
    height: number,
    stroke: Stroke
  ): ExcalidrawElement {
    return {
      type: 'freedraw',
      id: this.generateId(),
      x,
      y,
      width,
      height,
      strokeColor: stroke.color,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: this.scaleStrokeWidth(stroke.width),
      strokeStyle: 'solid',
      roughness: 0,
      opacity: stroke.opacity,
      angle: 0,
      points,
      pressures: Array(points.length).fill(ExcalidrawGenerator.PRESSURE_VALUE),
      simulatePressure: false,
      seed: this.generateSeed(),
      version: 1,
      versionNonce: this.generateSeed(),
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    };
  }

  private scaleStrokeWidth(width: number): number {
    const scaled = Math.floor(width / ExcalidrawGenerator.STROKE_WIDTH_DIVISOR);
    return Math.max(ExcalidrawGenerator.MIN_STROKE_WIDTH, scaled);
  }

  private generateId(): string {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }

  private generateSeed(): number {
    return Math.floor(Math.random() * ExcalidrawGenerator.MAX_SEED) + 1;
  }
}
