import type { Note, Page } from '@petrify/core';
import { uint8ArrayToBase64 } from './base64.js';

export interface ExcalidrawElement {
  readonly type: 'image';
  readonly id: string;
  readonly fileId: string;
  readonly status: 'saved';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly version: number;
  readonly versionNonce: number;
  readonly isDeleted: false;
  readonly groupIds: readonly string[];
  readonly frameId: null;
  readonly boundElements: null;
  readonly updated: number;
  readonly link: null;
  readonly locked: false;
  readonly opacity: 100;
  readonly angle: 0;
  readonly strokeColor: 'transparent';
  readonly backgroundColor: 'transparent';
  readonly fillStyle: 'solid';
  readonly strokeWidth: 0;
  readonly strokeStyle: 'solid';
  readonly roughness: 0;
  readonly roundness: null;
  readonly scale: readonly [1, 1];
}

export interface ExcalidrawFileEntry {
  readonly mimeType: 'image/png';
  readonly id: string;
  readonly dataURL: string;
  readonly created: number;
}

export interface ExcalidrawData {
  readonly type: 'excalidraw';
  readonly version: number;
  readonly source: string;
  readonly elements: readonly ExcalidrawElement[];
  readonly appState: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, ExcalidrawFileEntry>>;
}

export interface ExcalidrawDataWithoutFiles {
  readonly type: 'excalidraw';
  readonly version: number;
  readonly source: string;
  readonly elements: readonly ExcalidrawElement[];
  readonly appState: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, never>>;
}

export class ExcalidrawGenerator {
  /** 페이지 간 세로 간격 (px) */
  static readonly PAGE_GAP = 100;

  generate(note: Note): ExcalidrawData {
    const now = Date.now();
    const elements: ExcalidrawElement[] = [];
    const files: Record<string, ExcalidrawFileEntry> = {};

    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedPages.length; i++) {
      const page = sortedPages[i];
      const fileId = page.id;
      const elementId = `element-${page.id}`;

      elements.push(this.createImageElement(page, elementId, fileId, i, now));
      files[fileId] = this.createFileEntry(page, fileId, now);
    }

    return {
      type: 'excalidraw',
      version: 2,
      source: 'petrify-converter',
      elements,
      appState: {
        gridSize: null,
        viewBackgroundColor: '#ffffff',
      },
      files,
    };
  }

  generateWithoutFiles(note: Note): ExcalidrawDataWithoutFiles {
    const now = Date.now();
    const elements: ExcalidrawElement[] = [];

    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedPages.length; i++) {
      const page = sortedPages[i];
      const fileId = page.id;
      const elementId = `element-${page.id}`;

      elements.push(this.createImageElement(page, elementId, fileId, i, now));
    }

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

  private createImageElement(
    page: Page,
    elementId: string,
    fileId: string,
    index: number,
    timestamp: number,
  ): ExcalidrawElement {
    const y = index * (page.height + ExcalidrawGenerator.PAGE_GAP);

    return {
      type: 'image',
      id: elementId,
      fileId,
      status: 'saved',
      x: 0,
      y,
      width: page.width,
      height: page.height,
      seed: this.generateSeed(),
      version: 1,
      versionNonce: this.generateSeed(),
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: timestamp,
      link: null,
      locked: false,
      opacity: 100,
      angle: 0,
      strokeColor: 'transparent',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 0,
      strokeStyle: 'solid',
      roughness: 0,
      roundness: null,
      scale: [1, 1],
    };
  }

  private createFileEntry(
    page: Page,
    fileId: string,
    timestamp: number,
  ): ExcalidrawFileEntry {
    const base64 = uint8ArrayToBase64(page.imageData);
    return {
      mimeType: 'image/png',
      id: fileId,
      dataURL: `data:image/png;base64,${base64}`,
      created: timestamp,
    };
  }

  private generateSeed(): number {
    return Math.floor(Math.random() * 2_000_000_000);
  }
}
