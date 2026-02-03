# petrify TypeScript 포팅 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Python으로 작성된 petrify-converter를 TypeScript로 완전 포팅한다.

**Architecture:** 브라우저 환경(Obsidian = Electron)을 타겟으로, ArrayBuffer 입력 → Note 객체 → ExcalidrawData 객체 → .excalidraw.md 문자열의 파이프라인 구조를 유지한다. 이미지 처리는 Canvas API, ZIP은 JSZip, 압축은 lz-string을 사용한다.

**Tech Stack:** TypeScript, Vitest, JSZip, lz-string, Canvas API (OffscreenCanvas)

---

## Task 1: TypeScript 프로젝트 설정

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

**Step 1: package.json 생성**

```json
{
  "name": "petrify-converter",
  "version": "0.1.0",
  "description": "viwoods .note 파일을 Excalidraw 포맷으로 변환",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "lz-string": "^1.5.0"
  },
  "devDependencies": {
    "@types/lz-string": "^1.5.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: vitest.config.ts 생성**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 4: 의존성 설치**

Run: `npm install`
Expected: node_modules 생성, package-lock.json 생성

**Step 5: 커밋**

```bash
git add package.json tsconfig.json vitest.config.ts package-lock.json
git commit -m "chore: TypeScript 프로젝트 초기 설정"
```

---

## Task 2: Point와 Stroke 모델 포팅

**Files:**
- Create: `src/models/stroke.ts`
- Create: `tests/models/stroke.test.ts`

**Step 1: 테스트 파일 생성**

```typescript
// tests/models/stroke.test.ts
import { describe, it, expect } from 'vitest';
import { Point, Stroke, pointFromList, strokeFromPathData, splitByTimestampGap } from '../../src/models/stroke';

describe('Point', () => {
  it('Point 생성', () => {
    const point: Point = { x: 100, y: 200, timestamp: 1234567890 };
    expect(point.x).toBe(100);
    expect(point.y).toBe(200);
    expect(point.timestamp).toBe(1234567890);
  });

  it('pointFromList로 생성', () => {
    const point = pointFromList([100, 200, 1234567890]);
    expect(point.x).toBe(100);
    expect(point.y).toBe(200);
    expect(point.timestamp).toBe(1234567890);
  });
});

describe('Stroke', () => {
  it('Stroke 생성', () => {
    const points: Point[] = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 10, y: 10, timestamp: 1 },
    ];
    const stroke: Stroke = { points, color: '#000000', width: 1, opacity: 100 };
    expect(stroke.points).toHaveLength(2);
    expect(stroke.color).toBe('#000000');
  });

  it('커스텀 스타일', () => {
    const stroke: Stroke = {
      points: [{ x: 0, y: 0, timestamp: 0 }],
      color: '#ff0000',
      width: 2.5,
      opacity: 50,
    };
    expect(stroke.color).toBe('#ff0000');
    expect(stroke.width).toBe(2.5);
    expect(stroke.opacity).toBe(50);
  });
});

describe('strokeFromPathData', () => {
  it('path 데이터에서 Stroke 생성', () => {
    const pathData = [[0, 0, 100], [10, 5, 101], [20, 10, 102]];
    const stroke = strokeFromPathData(pathData);
    expect(stroke.points).toHaveLength(3);
    expect(stroke.points[0].x).toBe(0);
    expect(stroke.points[2].y).toBe(10);
  });
});

describe('splitByTimestampGap', () => {
  it('gap >= 6 기준으로 스트로크 분리', () => {
    const data = [
      [100, 100, 1], [101, 101, 2], [102, 102, 3], [103, 103, 4], [104, 104, 5],
      // gap = 6 (11 - 5 = 6)
      [200, 200, 11], [201, 201, 12], [202, 202, 13],
    ];
    const strokes = splitByTimestampGap(data, 6);
    expect(strokes).toHaveLength(2);
    expect(strokes[0].points).toHaveLength(5);
    expect(strokes[1].points).toHaveLength(3);
  });

  it('timestamp 순서로 정렬 후 분리', () => {
    const data = [[200, 200, 11], [100, 100, 1], [101, 101, 2]];
    const strokes = splitByTimestampGap(data, 6);
    expect(strokes).toHaveLength(2);
    expect(strokes[0].points[0].timestamp).toBe(1);
  });

  it('빈 데이터는 빈 배열 반환', () => {
    const strokes = splitByTimestampGap([], 6);
    expect(strokes).toHaveLength(0);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `npm test -- tests/models/stroke.test.ts`
Expected: FAIL - 모듈을 찾을 수 없음

**Step 3: stroke.ts 구현**

```typescript
// src/models/stroke.ts
export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

export function pointFromList(data: number[]): Point {
  return {
    x: data[0],
    y: data[1],
    timestamp: data[2],
  };
}

export function strokeFromPathData(
  data: number[][],
  color = '#000000',
  width = 1,
  opacity = 100
): Stroke {
  const points = data.map(pointFromList);
  return { points, color, width, opacity };
}

export function splitByTimestampGap(
  data: number[][],
  gapThreshold: number,
  color = '#000000',
  width = 1,
  opacity = 100
): Stroke[] {
  if (data.length === 0) {
    return [];
  }

  const sortedData = [...data].sort((a, b) => a[2] - b[2]);
  const strokes: Stroke[] = [];
  let currentPoints: Point[] = [pointFromList(sortedData[0])];

  for (let i = 1; i < sortedData.length; i++) {
    const prevTs = sortedData[i - 1][2];
    const currTs = sortedData[i][2];
    const gap = currTs - prevTs;

    if (gap >= gapThreshold) {
      strokes.push({ points: currentPoints, color, width, opacity });
      currentPoints = [];
    }

    currentPoints.push(pointFromList(sortedData[i]));
  }

  if (currentPoints.length > 0) {
    strokes.push({ points: currentPoints, color, width, opacity });
  }

  return strokes;
}
```

**Step 4: 테스트 통과 확인**

Run: `npm test -- tests/models/stroke.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/models/stroke.ts tests/models/stroke.test.ts
git commit -m "feat: Point와 Stroke 모델 포팅"
```

---

## Task 3: Page와 Note 모델 포팅

**Files:**
- Create: `src/models/page.ts`
- Create: `src/models/note.ts`
- Create: `src/models/index.ts`
- Create: `tests/models/page.test.ts`
- Create: `tests/models/note.test.ts`

**Step 1: Page 테스트 작성**

```typescript
// tests/models/page.test.ts
import { describe, it, expect } from 'vitest';
import { Page } from '../../src/models/page';

describe('Page', () => {
  it('Page 생성', () => {
    const page: Page = {
      id: 'page-1',
      strokes: [],
      width: 1440,
      height: 1920,
    };
    expect(page.id).toBe('page-1');
    expect(page.width).toBe(1440);
    expect(page.height).toBe(1920);
  });
});
```

**Step 2: Note 테스트 작성**

```typescript
// tests/models/note.test.ts
import { describe, it, expect } from 'vitest';
import { Note } from '../../src/models/note';

describe('Note', () => {
  it('Note 생성', () => {
    const note: Note = {
      title: 'Test Note',
      pages: [],
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    expect(note.title).toBe('Test Note');
    expect(note.pages).toHaveLength(0);
  });
});
```

**Step 3: 테스트 실패 확인**

Run: `npm test -- tests/models/page.test.ts tests/models/note.test.ts`
Expected: FAIL

**Step 4: page.ts 구현**

```typescript
// src/models/page.ts
import type { Stroke } from './stroke';

export interface Page {
  id: string;
  strokes: Stroke[];
  width: number;
  height: number;
}

export const DEFAULT_PAGE_WIDTH = 1440;
export const DEFAULT_PAGE_HEIGHT = 1920;
```

**Step 5: note.ts 구현**

```typescript
// src/models/note.ts
import type { Page } from './page';

export interface Note {
  title: string;
  pages: Page[];
  createdAt: Date;
  modifiedAt: Date;
}
```

**Step 6: index.ts 구현 (re-export)**

```typescript
// src/models/index.ts
export * from './stroke';
export * from './page';
export * from './note';
```

**Step 7: 테스트 통과 확인**

Run: `npm test -- tests/models/`
Expected: PASS

**Step 8: 커밋**

```bash
git add src/models/ tests/models/
git commit -m "feat: Page와 Note 모델 포팅"
```

---

## Task 4: ColorExtractor 포팅

**Files:**
- Create: `src/color-extractor.ts`
- Create: `tests/color-extractor.test.ts`

**Step 1: 테스트 작성**

```typescript
// tests/color-extractor.test.ts
import { describe, it, expect } from 'vitest';
import { ColorExtractor } from '../src/color-extractor';

function createTestImageData(
  width: number,
  height: number,
  fillColor: [number, number, number, number] = [255, 0, 0, 255]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillColor[0];
    data[i * 4 + 1] = fillColor[1];
    data[i * 4 + 2] = fillColor[2];
    data[i * 4 + 3] = fillColor[3];
  }
  return new ImageData(data, width, height);
}

describe('ColorExtractor', () => {
  describe('getColorAt', () => {
    it('포인트에서 색상 추출', () => {
      const imageData = createTestImageData(10, 10, [255, 0, 0, 255]);
      const extractor = new ColorExtractor(imageData);
      const { color, opacity } = extractor.getColorAt(5, 5);
      expect(color).toBe('#ff0000');
      expect(opacity).toBe(255);
    });

    it('투명도 있는 색상 추출', () => {
      const imageData = createTestImageData(10, 10, [0, 180, 250, 100]);
      const extractor = new ColorExtractor(imageData);
      const { color, opacity } = extractor.getColorAt(5, 5);
      expect(color).toBe('#00b4fa');
      expect(opacity).toBe(100);
    });

    it('범위 밖은 기본값 반환', () => {
      const imageData = createTestImageData(10, 10);
      const extractor = new ColorExtractor(imageData);
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
      const extractor = new ColorExtractor(imageData);
      expect(extractor.getWidthAt(5, 5)).toBe(5);
    });

    it('투명 픽셀에서는 0 반환', () => {
      const imageData = createTestImageData(10, 10, [0, 0, 0, 0]);
      const extractor = new ColorExtractor(imageData);
      expect(extractor.getWidthAt(5, 5)).toBe(0);
    });

    it('범위 밖은 0 반환', () => {
      const imageData = createTestImageData(10, 10, [255, 0, 0, 255]);
      const extractor = new ColorExtractor(imageData);
      expect(extractor.getWidthAt(-1, 5)).toBe(0);
      expect(extractor.getWidthAt(5, 100)).toBe(0);
    });
  });

  describe('extractStrokeWidth', () => {
    it('빈 포인트는 기본값 1 반환', () => {
      const imageData = createTestImageData(10, 10, [0, 0, 0, 0]);
      const extractor = new ColorExtractor(imageData);
      expect(extractor.extractStrokeWidth([])).toBe(1);
    });
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `npm test -- tests/color-extractor.test.ts`
Expected: FAIL

**Step 3: color-extractor.ts 구현**

```typescript
// src/color-extractor.ts
import type { Point } from './models/stroke';

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
```

**Step 4: 테스트 통과 확인**

Run: `npm test -- tests/color-extractor.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/color-extractor.ts tests/color-extractor.test.ts
git commit -m "feat: ColorExtractor 포팅"
```

---

## Task 5: NoteParser 포팅

**Files:**
- Create: `src/parser.ts`
- Create: `src/exceptions.ts`
- Create: `tests/parser.test.ts`

**Step 1: exceptions.ts 구현**

```typescript
// src/exceptions.ts
export class InvalidNoteFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNoteFileError';
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
```

**Step 2: 테스트 작성**

```typescript
// tests/parser.test.ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { NoteParser } from '../src/parser';

describe('NoteParser', () => {
  it('ZIP 파일 파싱', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const parser = new NoteParser();
    const note = await parser.parse(data.buffer);

    expect(note.pages.length).toBeGreaterThan(0);
  });

  it('스트로크가 timestamp gap으로 분리됨', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const parser = new NoteParser();
    const note = await parser.parse(data.buffer);

    const totalStrokes = note.pages.reduce((sum, page) => sum + page.strokes.length, 0);
    expect(totalStrokes).toBeGreaterThan(1);
  });
});
```

**Step 3: 테스트 실패 확인**

Run: `npm test -- tests/parser.test.ts`
Expected: FAIL

**Step 4: parser.ts 구현**

```typescript
// src/parser.ts
import JSZip from 'jszip';
import { ColorExtractor } from './color-extractor';
import { InvalidNoteFileError, ParseError } from './exceptions';
import type { Note } from './models/note';
import type { Page } from './models/page';
import type { Point, Stroke } from './models/stroke';
import { DEFAULT_PAGE_HEIGHT, DEFAULT_PAGE_WIDTH } from './models/page';
import { pointFromList, splitByTimestampGap } from './models/stroke';

export class NoteParser {
  static readonly RESOURCE_TYPE_MAINBMP = 1;
  static readonly RESOURCE_TYPE_PATH = 7;
  static readonly DEFAULT_GAP_THRESHOLD = 6;

  async parse(data: ArrayBuffer): Promise<Note> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch {
      throw new InvalidNoteFileError('Not a valid zip file');
    }

    return this.parseContents(zip);
  }

  private async parseContents(zip: JSZip): Promise<Note> {
    const noteInfo = await this.parseNoteInfo(zip);
    const pages = await this.parsePages(zip);

    return {
      title: noteInfo.fileName ?? 'Untitled',
      pages,
      createdAt: this.timestampToDate(noteInfo.creationTime ?? 0),
      modifiedAt: this.timestampToDate(noteInfo.lastModifiedTime ?? 0),
    };
  }

  private async parseNoteInfo(zip: JSZip): Promise<Record<string, unknown>> {
    const infoFile = Object.keys(zip.files).find((name) => name.endsWith('_NoteFileInfo.json'));
    if (!infoFile) return {};

    try {
      const content = await zip.file(infoFile)!.async('string');
      return JSON.parse(content);
    } catch (e) {
      throw new ParseError(`Failed to parse NoteFileInfo: ${e}`);
    }
  }

  private async parsePages(zip: JSZip): Promise<Page[]> {
    const pathFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('path_') && name.endsWith('.json')
    );

    const pathToMainbmp = await this.parsePageResource(zip);
    const mainbmpFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('mainBmp_') && name.endsWith('.png')
    );

    const pages: Page[] = [];

    for (const pathFile of pathFiles) {
      const pageId = pathFile.replace('path_', '').replace('.json', '');
      const mainbmpData = await this.loadMainbmp(zip, pageId, pathToMainbmp, mainbmpFiles);
      const strokes = await this.parseStrokes(zip, pathFile, mainbmpData);

      pages.push({
        id: pageId,
        strokes,
        width: DEFAULT_PAGE_WIDTH,
        height: DEFAULT_PAGE_HEIGHT,
      });
    }

    return pages.length > 0 ? pages : [{ id: 'empty', strokes: [], width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT }];
  }

  private async parsePageResource(zip: JSZip): Promise<Record<string, string>> {
    const resourceFile = Object.keys(zip.files).find((name) => name.endsWith('_PageResource.json'));
    if (!resourceFile) return {};

    try {
      const content = await zip.file(resourceFile)!.async('string');
      const resources: Array<{
        resourceType: number;
        id: string;
        fileName: string;
        nickname: string;
      }> = JSON.parse(content);

      const mainbmpById: Record<string, string> = {};
      const pathIdToMainbmpId: Record<string, string> = {};

      for (const res of resources) {
        if (res.resourceType === NoteParser.RESOURCE_TYPE_MAINBMP) {
          mainbmpById[res.id] = res.fileName;
        } else if (res.resourceType === NoteParser.RESOURCE_TYPE_PATH) {
          pathIdToMainbmpId[res.nickname] = res.nickname;
        }
      }

      const result: Record<string, string> = {};
      for (const [pathNickname, mainbmpId] of Object.entries(pathIdToMainbmpId)) {
        if (mainbmpId in mainbmpById) {
          result[pathNickname] = mainbmpById[mainbmpId];
        }
      }

      return result;
    } catch {
      return {};
    }
  }

  private async loadMainbmp(
    zip: JSZip,
    pageId: string,
    pathToMainbmp: Record<string, string>,
    mainbmpFiles: string[]
  ): Promise<ArrayBuffer | null> {
    if (pageId in pathToMainbmp) {
      const file = zip.file(pathToMainbmp[pageId]);
      if (file) {
        return file.async('arraybuffer');
      }
    }

    if (mainbmpFiles.length === 1) {
      return zip.file(mainbmpFiles[0])!.async('arraybuffer');
    }

    return null;
  }

  private async parseStrokes(
    zip: JSZip,
    pathFile: string,
    mainbmpData: ArrayBuffer | null
  ): Promise<Stroke[]> {
    let data: number[][];
    try {
      const content = await zip.file(pathFile)!.async('string');
      data = JSON.parse(content);
    } catch (e) {
      throw new ParseError(`Failed to parse stroke data: ${e}`);
    }

    if (!data || data.length === 0) return [];

    if (!mainbmpData) {
      return splitByTimestampGap(data, NoteParser.DEFAULT_GAP_THRESHOLD);
    }

    const extractor = await ColorExtractor.fromPng(mainbmpData);
    return this.splitStrokesWithColor(data, extractor);
  }

  private splitStrokesWithColor(data: number[][], extractor: ColorExtractor): Stroke[] {
    if (data.length === 0) return [];

    const sortedData = [...data].sort((a, b) => a[2] - b[2]);
    const strokes: Stroke[] = [];
    let currentPoints: number[][] = [];
    let currentColor: string | null = null;
    let currentAlpha: number | null = null;

    for (let i = 0; i < sortedData.length; i++) {
      const pointData = sortedData[i];
      const x = Math.floor(pointData[0]);
      const y = Math.floor(pointData[1]);
      let { color, opacity: alpha } = extractor.getColorAt(x, y);

      const isBackground = ColorExtractor.BACKGROUND_COLORS.has(color.toLowerCase());

      if (isBackground) {
        if (currentColor !== null) {
          color = currentColor;
          alpha = currentAlpha!;
        } else {
          color = '#000000';
          alpha = 255;
        }
      }

      if (i > 0) {
        const prevTs = sortedData[i - 1][2];
        const currTs = pointData[2];
        const gap = currTs - prevTs;

        const colorChanged = currentColor !== null && !isBackground && color !== currentColor;

        if (gap >= NoteParser.DEFAULT_GAP_THRESHOLD || colorChanged) {
          if (currentPoints.length > 0) {
            const width = extractor.extractStrokeWidth(currentPoints);
            strokes.push({
              points: currentPoints.map(pointFromList),
              color: currentColor ?? '#000000',
              width,
              opacity: this.alphaToOpacity(currentAlpha),
            });
          }
          currentPoints = [];
        }
      }

      currentPoints.push(pointData);
      if (!isBackground || currentColor === null) {
        currentColor = color;
        currentAlpha = alpha;
      }
    }

    if (currentPoints.length > 0) {
      const width = extractor.extractStrokeWidth(currentPoints);
      strokes.push({
        points: currentPoints.map(pointFromList),
        color: currentColor ?? '#000000',
        width,
        opacity: this.alphaToOpacity(currentAlpha),
      });
    }

    return strokes;
  }

  private alphaToOpacity(alpha: number | null): number {
    if (alpha === null) return 100;
    return Math.round((alpha / 255) * 100);
  }

  private timestampToDate(timestamp: number): Date {
    if (timestamp === 0) return new Date();
    return new Date(timestamp);
  }
}
```

**Step 5: 테스트 통과 확인**

Run: `npm test -- tests/parser.test.ts`
Expected: PASS

**Step 6: 커밋**

```bash
git add src/parser.ts src/exceptions.ts tests/parser.test.ts
git commit -m "feat: NoteParser 포팅"
```

---

## Task 6: ExcalidrawGenerator 포팅

**Files:**
- Create: `src/excalidraw.ts`
- Create: `tests/excalidraw.test.ts`

**Step 1: 테스트 작성**

```typescript
// tests/excalidraw.test.ts
import { describe, it, expect } from 'vitest';
import { ExcalidrawGenerator } from '../src/excalidraw';
import type { Note } from '../src/models/note';
import type { Page } from '../src/models/page';
import type { Point, Stroke } from '../src/models/stroke';

describe('ExcalidrawGenerator', () => {
  describe('createFreedraw', () => {
    it('freedraw 요소 생성', () => {
      const points: Point[] = [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 5, timestamp: 1 },
        { x: 20, y: 10, timestamp: 2 },
      ];
      const stroke: Stroke = { points, color: '#000000', width: 1, opacity: 100 };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.type).toBe('freedraw');
      expect(element.strokeColor).toBe('#000000');
      expect(element.strokeWidth).toBe(1);
      expect(element.points).toHaveLength(3);
    });

    it('필수 필드 포함', () => {
      const stroke: Stroke = {
        points: [{ x: 0, y: 0, timestamp: 0 }],
        color: '#ff0000',
        width: 2,
        opacity: 100,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      const requiredFields = [
        'type', 'id', 'x', 'y', 'width', 'height',
        'strokeColor', 'strokeWidth', 'points', 'opacity', 'roughness', 'seed',
      ];
      for (const field of requiredFields) {
        expect(element).toHaveProperty(field);
      }
    });

    it('투명도 적용', () => {
      const stroke: Stroke = {
        points: [{ x: 0, y: 0, timestamp: 1 }, { x: 10, y: 10, timestamp: 2 }],
        color: '#ff00bc',
        width: 1,
        opacity: 50,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.strokeColor).toBe('#ff00bc');
      expect(element.opacity).toBe(50);
    });

    it('simulatePressure가 false', () => {
      const stroke: Stroke = {
        points: [{ x: 0, y: 0, timestamp: 0 }, { x: 10, y: 10, timestamp: 1 }],
        color: '#000000',
        width: 8,
        opacity: 100,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.simulatePressure).toBe(false);
    });

    it('pressures가 0.5로 채워짐', () => {
      const stroke: Stroke = {
        points: [
          { x: 0, y: 0, timestamp: 0 },
          { x: 10, y: 10, timestamp: 1 },
          { x: 20, y: 20, timestamp: 2 },
        ],
        color: '#000000',
        width: 8,
        opacity: 100,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.pressures).toEqual([0.5, 0.5, 0.5]);
    });
  });

  describe('scaleStrokeWidth', () => {
    it('일반 스케일링', () => {
      const generator = new ExcalidrawGenerator();
      expect(generator['scaleStrokeWidth'](6)).toBe(1);
      expect(generator['scaleStrokeWidth'](12)).toBe(2);
      expect(generator['scaleStrokeWidth'](18)).toBe(3);
      expect(generator['scaleStrokeWidth'](74)).toBe(12);
    });

    it('최소값 1 보장', () => {
      const generator = new ExcalidrawGenerator();
      expect(generator['scaleStrokeWidth'](1)).toBe(1);
      expect(generator['scaleStrokeWidth'](0)).toBe(1);
    });
  });

  describe('generate', () => {
    it('전체 문서 생성', () => {
      const page: Page = {
        id: 'page-1',
        strokes: [{
          points: [{ x: 0, y: 0, timestamp: 0 }, { x: 10, y: 10, timestamp: 1 }],
          color: '#000000',
          width: 1,
          opacity: 100,
        }],
        width: 1440,
        height: 1920,
      };
      const note: Note = {
        title: 'Test',
        pages: [page],
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.type).toBe('excalidraw');
      expect(doc.version).toBe(2);
      expect(doc.elements).toBeDefined();
      expect(doc.appState).toBeDefined();
    });
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `npm test -- tests/excalidraw.test.ts`
Expected: FAIL

**Step 3: excalidraw.ts 구현**

```typescript
// src/excalidraw.ts
import type { Note } from './models/note';
import type { Page } from './models/page';
import type { Stroke } from './models/stroke';

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

  generate(note: Note): ExcalidrawData {
    const elements: ExcalidrawElement[] = [];
    let yOffset = 0;

    for (const page of note.pages) {
      const pageElements = this.generatePageElements(page, yOffset);
      elements.push(...pageElements);
      yOffset += page.height + ExcalidrawGenerator.PAGE_GAP;
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

  private generatePageElements(page: Page, yOffset: number): ExcalidrawElement[] {
    return page.strokes.map((stroke) => this.createFreedraw(stroke, 0, yOffset));
  }

  createFreedraw(stroke: Stroke, xOffset: number, yOffset: number): ExcalidrawElement {
    if (stroke.points.length === 0) {
      return this.createFreedrawElement(xOffset, yOffset, [], 0, 0, stroke);
    }

    const firstPoint = stroke.points[0];
    const x = firstPoint.x + xOffset;
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
      pressures: Array(points.length).fill(0.5),
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
    return Math.floor(Math.random() * 2147483647) + 1;
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `npm test -- tests/excalidraw.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/excalidraw.ts tests/excalidraw.test.ts
git commit -m "feat: ExcalidrawGenerator 포팅"
```

---

## Task 7: ExcalidrawMdGenerator 포팅

**Files:**
- Create: `src/excalidraw-md.ts`
- Create: `tests/excalidraw-md.test.ts`

**Step 1: 테스트 작성**

```typescript
// tests/excalidraw-md.test.ts
import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import { ExcalidrawMdGenerator } from '../src/excalidraw-md';
import type { ExcalidrawData } from '../src/excalidraw';

describe('ExcalidrawMdGenerator', () => {
  it('올바른 마크다운 구조 생성', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };

    const md = generator.generate(data);

    expect(md).toContain('---');
    expect(md).toContain('excalidraw-plugin: parsed');
    expect(md).toContain('# Excalidraw Data');
    expect(md).toContain('## Text Elements');
    expect(md).toContain('## Drawing');
    expect(md).toContain('```compressed-json');
  });

  it('데이터가 압축됨', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'test', type: 'freedraw' } as any],
      appState: {},
      files: {},
    };

    const md = generator.generate(data);

    expect(md).not.toContain('"type": "excalidraw"');
    expect(md).toContain('```compressed-json');
  });

  it('압축 후 해제하면 원본 복원', () => {
    const generator = new ExcalidrawMdGenerator();
    const originalData: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'test123', type: 'freedraw', x: 100, y: 200 } as any],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };

    const md = generator.generate(originalData);

    const match = md.match(/```compressed-json\n(.+?)\n```/s);
    expect(match).not.toBeNull();

    const compressed = match![1];
    const decompressed = LZString.decompressFromBase64(compressed);
    const restored = JSON.parse(decompressed!);

    expect(restored).toEqual(originalData);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `npm test -- tests/excalidraw-md.test.ts`
Expected: FAIL

**Step 3: excalidraw-md.ts 구현**

```typescript
// src/excalidraw-md.ts
import LZString from 'lz-string';
import type { ExcalidrawData } from './excalidraw';

export class ExcalidrawMdGenerator {
  generate(
    excalidrawData: ExcalidrawData,
    embeddedFiles?: Record<string, string>
  ): string {
    const compressed = this.compress(excalidrawData);
    const embeddedSection = this.generateEmbeddedSection(embeddedFiles);

    return `---
excalidraw-plugin: parsed
tags:
---

# Excalidraw Data

## Text Elements
## Embedded Files
${embeddedSection}
%%
## Drawing
\`\`\`compressed-json
${compressed}
\`\`\`
%%
`;
  }

  private compress(data: ExcalidrawData): string {
    const jsonStr = JSON.stringify(data);
    return LZString.compressToBase64(jsonStr);
  }

  private generateEmbeddedSection(embeddedFiles?: Record<string, string>): string {
    if (!embeddedFiles || Object.keys(embeddedFiles).length === 0) {
      return '\n';
    }

    const lines: string[] = [];
    for (const [fileId, filename] of Object.entries(embeddedFiles)) {
      lines.push(`${fileId}: [[${filename}]]`);
    }

    return '\n' + lines.join('\n') + '\n';
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `npm test -- tests/excalidraw-md.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/excalidraw-md.ts tests/excalidraw-md.test.ts
git commit -m "feat: ExcalidrawMdGenerator 포팅"
```

---

## Task 8: 공개 API (convert 함수) 구현

**Files:**
- Create: `src/index.ts`
- Create: `tests/integration.test.ts`

**Step 1: 테스트 작성**

```typescript
// tests/integration.test.ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { convert, convertToMd } from '../src/index';

describe('Integration', () => {
  it('convert: ArrayBuffer → ExcalidrawData', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const result = await convert(data.buffer);

    expect(result.type).toBe('excalidraw');
    expect(result.version).toBe(2);
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('convertToMd: ArrayBuffer → .excalidraw.md string', async () => {
    const noteFile = join(__dirname, '../examples/normal/normal.note');
    const data = await readFile(noteFile);
    const result = await convertToMd(data.buffer);

    expect(result).toContain('excalidraw-plugin: parsed');
    expect(result).toContain('```compressed-json');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `npm test -- tests/integration.test.ts`
Expected: FAIL

**Step 3: index.ts 구현**

```typescript
// src/index.ts
export { NoteParser } from './parser';
export { ColorExtractor } from './color-extractor';
export { ExcalidrawGenerator } from './excalidraw';
export type { ExcalidrawData, ExcalidrawElement } from './excalidraw';
export { ExcalidrawMdGenerator } from './excalidraw-md';
export { InvalidNoteFileError, ParseError } from './exceptions';
export * from './models';

import { NoteParser } from './parser';
import { ExcalidrawGenerator, ExcalidrawData } from './excalidraw';
import { ExcalidrawMdGenerator } from './excalidraw-md';

export async function convert(data: ArrayBuffer): Promise<ExcalidrawData> {
  const parser = new NoteParser();
  const note = await parser.parse(data);
  const generator = new ExcalidrawGenerator();
  return generator.generate(note);
}

export async function convertToMd(data: ArrayBuffer): Promise<string> {
  const excalidrawData = await convert(data);
  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData);
}
```

**Step 4: 테스트 통과 확인**

Run: `npm test -- tests/integration.test.ts`
Expected: PASS

**Step 5: 전체 테스트 실행**

Run: `npm test`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add src/index.ts tests/integration.test.ts
git commit -m "feat: 공개 API (convert, convertToMd) 구현"
```

---

## Task 9: Python 코드 제거

**Files:**
- Delete: `src/petrify_converter/` (전체 디렉터리)
- Delete: `tests/*.py` (Python 테스트 파일들)
- Delete: `tests/models/*.py` (Python 모델 테스트)
- Delete: `pyproject.toml`
- Delete: `uv.lock`

**Step 1: Python 소스 코드 삭제**

Run: `rm -rf src/petrify_converter`
Expected: 디렉터리 삭제됨

**Step 2: Python 테스트 코드 삭제**

Run: `rm -rf tests/*.py tests/models/*.py tests/models/__init__.py tests/__init__.py tests/conftest.py`
Expected: Python 테스트 파일 삭제됨

**Step 3: Python 프로젝트 파일 삭제**

Run: `rm -f pyproject.toml uv.lock`
Expected: 파일 삭제됨

**Step 4: TypeScript 테스트 통과 확인**

Run: `npm test`
Expected: ALL PASS

**Step 5: 커밋**

```bash
git add -A
git commit -m "chore: Python 코드 제거, TypeScript로 완전 전환"
```

---

## Task 10: 최종 정리 및 문서화

**Files:**
- Modify: `README.md` (있다면)
- Modify: `.gitignore`

**Step 1: .gitignore 업데이트**

```gitignore
# Node
node_modules/
dist/

# IDE
.idea/
.vscode/

# OS
.DS_Store

# Test
coverage/
```

**Step 2: 빌드 테스트**

Run: `npm run build`
Expected: dist/ 폴더에 index.js, index.d.ts 생성

**Step 3: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add -A
git commit -m "chore: 프로젝트 정리 및 빌드 설정 완료"
```

---

## 완료 조건

- [ ] 모든 테스트 통과 (`npm test`)
- [ ] 빌드 성공 (`npm run build`)
- [ ] 타입체크 통과 (`npm run typecheck`)
- [ ] Python 코드 완전 제거
- [ ] examples/ 폴더의 샘플 파일로 변환 테스트 성공
