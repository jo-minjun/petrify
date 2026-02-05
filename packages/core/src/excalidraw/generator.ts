import type { Note } from '../models/index.js';

export interface ExcalidrawElement {
  readonly type: string;
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly strokeColor: string;
  readonly backgroundColor: string;
  readonly fillStyle: string;
  readonly strokeWidth: number;
  readonly strokeStyle: string;
  readonly roughness: number;
  readonly opacity: number;
  readonly angle: number;
  readonly points: readonly number[][];
  readonly pressures: readonly number[];
  readonly simulatePressure: boolean;
  readonly seed: number;
  readonly version: number;
  readonly versionNonce: number;
  readonly isDeleted: boolean;
  readonly groupIds: readonly string[];
  readonly frameId: string | null;
  readonly boundElements: readonly unknown[] | null;
  readonly updated: number;
  readonly link: string | null;
  readonly locked: boolean;
}

export interface ExcalidrawData {
  readonly type: 'excalidraw';
  readonly version: number;
  readonly source: string;
  readonly elements: readonly ExcalidrawElement[];
  readonly appState: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, unknown>>;
}

// TODO(2026-02-05, minjun.jo): Task 3에서 image element 생성 로직으로 리팩토링 예정
export class ExcalidrawGenerator {
  /** 페이지 간 세로 간격 (px) */
  static readonly PAGE_GAP = 100;

  generate(note: Note): ExcalidrawData {
    return {
      type: 'excalidraw',
      version: 2,
      source: 'petrify-converter',
      elements: [],
      appState: {
        gridSize: null,
        viewBackgroundColor: '#ffffff',
      },
      files: {},
    };
  }
}
