# WatcherPort 확장성 구조 리팩토링 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** WatcherPort를 core에 포트로 정의하고, ConversionStatePort + ConversionPipeline을 추가하여 다양한 파일 감시 소스(로컬 FS, Obsidian Vault, Google Drive 등)를 확장 가능한 구조로 만든다.

**Architecture:** core에 WatcherPort, ConversionStatePort 포트 인터페이스와 ConversionPipeline 오케스트레이터를 추가한다. 현재 obsidian-plugin의 PetrifyWatcher는 @petrify/watcher-chokidar 패키지로 분리한다. obsidian-plugin의 handleFileChange 로직(mtime 스킵, 파싱, 변환)은 core의 ConversionPipeline으로 이동한다.

**Tech Stack:** TypeScript, Vitest, pnpm workspace

---

### Task 1: WatcherPort, FileChangeEvent 포트 정의

**Files:**
- Create: `packages/core/src/ports/watcher.ts`
- Modify: `packages/core/src/ports/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/ports/watcher.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/tests/ports/watcher.test.ts
import { describe, it, expect } from 'vitest';
import type { WatcherPort, FileChangeEvent } from '../../src/ports/watcher.js';

describe('WatcherPort', () => {
  it('FileChangeEvent는 readData를 통해 lazy하게 데이터를 읽는다', async () => {
    const testData = new ArrayBuffer(8);
    const event: FileChangeEvent = {
      id: '/path/to/file.note',
      name: 'file.note',
      extension: '.note',
      mtime: 1700000000000,
      readData: async () => testData,
    };

    expect(event.id).toBe('/path/to/file.note');
    expect(event.name).toBe('file.note');
    expect(event.extension).toBe('.note');
    expect(event.mtime).toBe(1700000000000);

    const data = await event.readData();
    expect(data).toBe(testData);
  });

  it('WatcherPort 구현체는 start/stop 라이프사이클을 가진다', async () => {
    let started = false;
    let stopped = false;
    let fileHandler: ((event: FileChangeEvent) => Promise<void>) | null = null;
    let errorHandler: ((error: Error) => void) | null = null;

    const watcher: WatcherPort = {
      onFileChange(handler) { fileHandler = handler; },
      onError(handler) { errorHandler = handler; },
      async start() { started = true; },
      async stop() { stopped = true; },
    };

    watcher.onFileChange(async () => {});
    watcher.onError(() => {});

    await watcher.start();
    expect(started).toBe(true);

    await watcher.stop();
    expect(stopped).toBe(true);

    expect(fileHandler).not.toBeNull();
    expect(errorHandler).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @petrify/core test -- --run packages/core/tests/ports/watcher.test.ts`
Expected: FAIL - cannot resolve `../../src/ports/watcher.js`

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/ports/watcher.ts
export interface FileChangeEvent {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly mtime: number;
  readData(): Promise<ArrayBuffer>;
}

export interface WatcherPort {
  onFileChange(handler: (event: FileChangeEvent) => Promise<void>): void;
  onError(handler: (error: Error) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

```typescript
// packages/core/src/ports/index.ts (수정)
export type { ParserPort } from './parser.js';
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ocr.js';
export type { WatcherPort, FileChangeEvent } from './watcher.js';
```

```typescript
// packages/core/src/index.ts (추가)
export type { WatcherPort, FileChangeEvent } from './ports/watcher.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @petrify/core test -- --run packages/core/tests/ports/watcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/ports/watcher.ts packages/core/src/ports/index.ts packages/core/src/index.ts packages/core/tests/ports/watcher.test.ts
git commit -m "feat: WatcherPort, FileChangeEvent 포트 인터페이스 정의"
```

---

### Task 2: ConversionStatePort 포트 정의

**Files:**
- Create: `packages/core/src/ports/conversion-state.ts`
- Modify: `packages/core/src/ports/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/ports/conversion-state.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/tests/ports/conversion-state.test.ts
import { describe, it, expect } from 'vitest';
import type { ConversionStatePort } from '../../src/ports/conversion-state.js';

describe('ConversionStatePort', () => {
  it('변환 이력이 없으면 undefined를 반환한다', async () => {
    const state: ConversionStatePort = {
      getLastConvertedMtime: async () => undefined,
    };

    const result = await state.getLastConvertedMtime('unknown-id');
    expect(result).toBeUndefined();
  });

  it('변환 이력이 있으면 mtime을 반환한다', async () => {
    const store = new Map<string, number>([['file-1', 1700000000000]]);

    const state: ConversionStatePort = {
      getLastConvertedMtime: async (id) => store.get(id),
    };

    const result = await state.getLastConvertedMtime('file-1');
    expect(result).toBe(1700000000000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @petrify/core test -- --run packages/core/tests/ports/conversion-state.test.ts`
Expected: FAIL - cannot resolve `../../src/ports/conversion-state.js`

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/ports/conversion-state.ts
export interface ConversionStatePort {
  getLastConvertedMtime(id: string): Promise<number | undefined>;
}
```

```typescript
// packages/core/src/ports/index.ts (수정)
export type { ParserPort } from './parser.js';
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ocr.js';
export type { WatcherPort, FileChangeEvent } from './watcher.js';
export type { ConversionStatePort } from './conversion-state.js';
```

```typescript
// packages/core/src/index.ts (추가)
export type { ConversionStatePort } from './ports/conversion-state.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @petrify/core test -- --run packages/core/tests/ports/conversion-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/ports/conversion-state.ts packages/core/src/ports/index.ts packages/core/src/index.ts packages/core/tests/ports/conversion-state.test.ts
git commit -m "feat: ConversionStatePort 포트 인터페이스 정의"
```

---

### Task 3: ConversionPipeline 오케스트레이터

mtime 스킵 판단 + 확장자 필터링 + 변환 실행을 core에서 처리한다.

**Files:**
- Create: `packages/core/src/conversion-pipeline.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/conversion-pipeline.test.ts`
- Reference: `packages/core/src/api.ts` (기존 convert 함수 활용)

**Step 1: Write the failing test**

```typescript
// packages/core/tests/conversion-pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversionPipeline } from '../src/conversion-pipeline.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { ConversionStatePort } from '../src/ports/conversion-state.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';
import type { Note, Stroke } from '../src/models/index.js';

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

const testStroke: Stroke = {
  points: [
    { x: 0, y: 0, timestamp: 0 },
    { x: 100, y: 100, timestamp: 1 },
  ],
  color: '#000000',
  width: 2,
  opacity: 100,
};

const mockNote: Note = {
  title: 'Test Note',
  createdAt: new Date('2026-02-03'),
  modifiedAt: new Date('2026-02-03'),
  pages: [{
    id: 'page-1',
    width: 100,
    height: 100,
    strokes: [testStroke],
  }],
};

function createMockParser(): ParserPort {
  return {
    extensions: ['.note'],
    parse: vi.fn().mockResolvedValue(mockNote),
  };
}

function createMockOcr(): OcrPort {
  return {
    recognize: vi.fn().mockResolvedValue({
      text: '테스트',
      regions: [{ text: '테스트', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
    } satisfies OcrResult),
  };
}

function createEvent(overrides?: Partial<FileChangeEvent>): FileChangeEvent {
  return {
    id: '/path/to/file.note',
    name: 'file.note',
    extension: '.note',
    mtime: 1700000000000,
    readData: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    ...overrides,
  };
}

describe('ConversionPipeline', () => {
  let parser: ParserPort;
  let ocr: OcrPort;
  let conversionState: ConversionStatePort;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = createMockParser();
    ocr = createMockOcr();
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('지원하는 확장자의 파일을 변환한다', async () => {
    const pipeline = new ConversionPipeline(
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent();

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(result).toContain('excalidraw-plugin: parsed');
    expect(event.readData).toHaveBeenCalled();
  });

  it('지원하지 않는 확장자면 null을 반환한다', async () => {
    const pipeline = new ConversionPipeline(
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ extension: '.txt', name: 'file.txt' });

    const result = await pipeline.handleFileChange(event);

    expect(result).toBeNull();
    expect(event.readData).not.toHaveBeenCalled();
  });

  it('source mtime이 last converted mtime 이하이면 스킵한다', async () => {
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(1700000000000),
    };
    const pipeline = new ConversionPipeline(
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ mtime: 1700000000000 });

    const result = await pipeline.handleFileChange(event);

    expect(result).toBeNull();
    expect(event.readData).not.toHaveBeenCalled();
  });

  it('source mtime이 last converted mtime보다 크면 변환한다', async () => {
    conversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(1699999999999),
    };
    const pipeline = new ConversionPipeline(
      [parser], ocr, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent({ mtime: 1700000000000 });

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(event.readData).toHaveBeenCalled();
  });

  it('OCR 없이 동작한다', async () => {
    const pipeline = new ConversionPipeline(
      [parser], null, conversionState, { confidenceThreshold: 50 }
    );
    const event = createEvent();

    const result = await pipeline.handleFileChange(event);

    expect(result).not.toBeNull();
    expect(result).toContain('excalidraw-plugin: parsed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @petrify/core test -- --run packages/core/tests/conversion-pipeline.test.ts`
Expected: FAIL - cannot resolve `../src/conversion-pipeline.js`

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/conversion-pipeline.ts
import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import type { ConversionStatePort } from './ports/conversion-state.js';
import type { FileChangeEvent } from './ports/watcher.js';
import { convertToMd, convertToMdWithOcr } from './api.js';

export interface ConversionPipelineOptions {
  readonly confidenceThreshold: number;
}

export class ConversionPipeline {
  private readonly parserMap: Map<string, ParserPort>;

  constructor(
    parsers: ParserPort[],
    private readonly ocr: OcrPort | null,
    private readonly conversionState: ConversionStatePort,
    private readonly options: ConversionPipelineOptions,
  ) {
    this.parserMap = new Map();
    for (const parser of parsers) {
      for (const ext of parser.extensions) {
        this.parserMap.set(ext.toLowerCase(), parser);
      }
    }
  }

  async handleFileChange(event: FileChangeEvent): Promise<string | null> {
    const parser = this.parserMap.get(event.extension.toLowerCase());
    if (!parser) return null;

    const lastMtime = await this.conversionState.getLastConvertedMtime(event.id);
    if (lastMtime !== undefined && event.mtime <= lastMtime) return null;

    const data = await event.readData();

    if (this.ocr) {
      return convertToMdWithOcr(data, parser, this.ocr, {
        ocrConfidenceThreshold: this.options.confidenceThreshold,
      });
    }

    return convertToMd(data, parser);
  }
}
```

```typescript
// packages/core/src/index.ts (추가)
export { ConversionPipeline } from './conversion-pipeline.js';
export type { ConversionPipelineOptions } from './conversion-pipeline.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @petrify/core test -- --run packages/core/tests/conversion-pipeline.test.ts`
Expected: PASS

**Step 5: Run all core tests**

Run: `pnpm --filter @petrify/core test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add packages/core/src/conversion-pipeline.ts packages/core/src/index.ts packages/core/tests/conversion-pipeline.test.ts
git commit -m "feat: ConversionPipeline 오케스트레이터 추가"
```

---

### Task 4: @petrify/watcher-chokidar 패키지 생성

현재 obsidian-plugin의 PetrifyWatcher를 독립 패키지로 분리하여 WatcherPort를 구현한다.

**Files:**
- Create: `packages/watcher/chokidar/package.json`
- Create: `packages/watcher/chokidar/tsconfig.json`
- Create: `packages/watcher/chokidar/src/index.ts`
- Create: `packages/watcher/chokidar/src/chokidar-watcher.ts`
- Test: `packages/watcher/chokidar/tests/chokidar-watcher.test.ts`
- Modify: `tsconfig.json` (루트 - paths 추가)
- Modify: `pnpm-workspace.yaml` (패키지 경로 확인)

**Step 1: 패키지 설정 파일 생성**

```json
// packages/watcher/chokidar/package.json
{
  "name": "@petrify/watcher-chokidar",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@petrify/core": "workspace:*",
    "chokidar": "^5.0.0"
  }
}
```

```json
// packages/watcher/chokidar/tsconfig.json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 2: pnpm-workspace.yaml 확인**

```yaml
# pnpm-workspace.yaml - packages/* 패턴이 이미 있으면 packages/**도 포함되는지 확인
# packages/**/로 되어 있으면 OK, 아니면 packages/watcher/* 추가 필요
```

Run: `cat pnpm-workspace.yaml`

```json
// tsconfig.json (루트 - paths 추가)
{
  "paths": {
    "@petrify/core": ["packages/core/src/index.ts"],
    "@petrify/parser-viwoods": ["packages/parser/viwoods/src/index.ts"],
    "@petrify/ocr-gutenye": ["packages/ocr/gutenye/src/index.ts"],
    "@petrify/watcher-chokidar": ["packages/watcher/chokidar/src/index.ts"]
  }
}
```

**Step 3: Write the failing test**

```typescript
// packages/watcher/chokidar/tests/chokidar-watcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileChangeEvent } from '@petrify/core';
import { ChokidarWatcher } from '../src/chokidar-watcher.js';

vi.mock('chokidar', () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    default: {
      watch: vi.fn(() => ({
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          handlers.set(event, handler);
          return { on: vi.fn() };
        }),
        close: vi.fn().mockResolvedValue(undefined),
      })),
    },
    _getHandlers: () => handlers,
  };
});

describe('ChokidarWatcher', () => {
  let watcher: ChokidarWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    watcher = new ChokidarWatcher('/watch/dir');
  });

  it('WatcherPort 인터페이스를 구현한다', () => {
    expect(typeof watcher.onFileChange).toBe('function');
    expect(typeof watcher.onError).toBe('function');
    expect(typeof watcher.start).toBe('function');
    expect(typeof watcher.stop).toBe('function');
  });

  it('start 전에 핸들러를 등록할 수 있다', () => {
    const fileHandler = vi.fn();
    const errorHandler = vi.fn();

    watcher.onFileChange(fileHandler);
    watcher.onError(errorHandler);

    // 에러 없이 등록 완료
    expect(true).toBe(true);
  });
});
```

**Step 4: Run test to verify it fails**

Run: `pnpm --filter @petrify/watcher-chokidar test -- --run`
Expected: FAIL - cannot resolve `../src/chokidar-watcher.js`

**Step 5: Write minimal implementation**

```typescript
// packages/watcher/chokidar/src/chokidar-watcher.ts
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { WatcherPort, FileChangeEvent } from '@petrify/core';

export class ChokidarWatcher implements WatcherPort {
  private watcher: FSWatcher | null = null;
  private fileHandler: ((event: FileChangeEvent) => Promise<void>) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  constructor(private readonly dir: string) {}

  onFileChange(handler: (event: FileChangeEvent) => Promise<void>): void {
    this.fileHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  async start(): Promise<void> {
    this.watcher = chokidar.watch(this.dir, {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });

    this.watcher.on('add', (filePath, stats) => this.handleFileEvent(filePath, stats));
    this.watcher.on('change', (filePath, stats) => this.handleFileEvent(filePath, stats));
    this.watcher.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorHandler?.(err);
    });
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }

  private async handleFileEvent(
    filePath: string,
    stats: { mtimeMs: number } | undefined
  ): Promise<void> {
    const mtime = stats?.mtimeMs ?? Date.now();

    const event: FileChangeEvent = {
      id: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      mtime,
      readData: () => fs.readFile(filePath).then((buf) => buf.buffer as ArrayBuffer),
    };

    try {
      await this.fileHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }
}
```

```typescript
// packages/watcher/chokidar/src/index.ts
export { ChokidarWatcher } from './chokidar-watcher.js';
```

**Step 6: Run test to verify it passes**

Run: `pnpm install && pnpm --filter @petrify/watcher-chokidar test -- --run`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/watcher/chokidar/ tsconfig.json pnpm-lock.yaml
git commit -m "feat: @petrify/watcher-chokidar 패키지 생성 (WatcherPort 구현)"
```

---

### Task 5: obsidian-plugin에서 새 구조로 전환

PetrifyWatcher, Converter, handleFileChange 로직을 ConversionPipeline + WatcherPort로 교체한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`
- Modify: `packages/obsidian-plugin/package.json` (watcher-chokidar 의존성 추가)
- Delete: `packages/obsidian-plugin/src/watcher.ts` (ChokidarWatcher로 대체)
- Delete: `packages/obsidian-plugin/src/converter.ts` (ConversionPipeline으로 대체)
- Delete: `packages/obsidian-plugin/src/parser-registry.ts` (ConversionPipeline이 내부 관리)
- Create: `packages/obsidian-plugin/src/frontmatter-conversion-state.ts`
- Modify: `packages/obsidian-plugin/tests/watcher.test.ts` → 삭제
- Modify: `packages/obsidian-plugin/tests/converter.test.ts` → 삭제
- Modify: `packages/obsidian-plugin/tests/parser-registry.test.ts` → 삭제
- Test: `packages/obsidian-plugin/tests/frontmatter-conversion-state.test.ts`

**Step 1: FrontmatterConversionState 테스트 작성**

```typescript
// packages/obsidian-plugin/tests/frontmatter-conversion-state.test.ts
import { describe, it, expect, vi } from 'vitest';
import { FrontmatterConversionState } from '../src/frontmatter-conversion-state.js';

describe('FrontmatterConversionState', () => {
  it('파일이 존재하지 않으면 undefined를 반환한다', async () => {
    const readFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
    const state = new FrontmatterConversionState(readFile);

    const result = await state.getLastConvertedMtime('nonexistent.excalidraw.md');
    expect(result).toBeUndefined();
  });

  it('frontmatter에서 mtime을 읽는다', async () => {
    const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1700000000000
excalidraw-plugin: parsed
---

content`;
    const readFile = vi.fn().mockResolvedValue(content);
    const state = new FrontmatterConversionState(readFile);

    const result = await state.getLastConvertedMtime('file.excalidraw.md');
    expect(result).toBe(1700000000000);
  });

  it('frontmatter가 없으면 undefined를 반환한다', async () => {
    const readFile = vi.fn().mockResolvedValue('no frontmatter here');
    const state = new FrontmatterConversionState(readFile);

    const result = await state.getLastConvertedMtime('file.excalidraw.md');
    expect(result).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @petrify/obsidian-plugin test -- --run packages/obsidian-plugin/tests/frontmatter-conversion-state.test.ts`
Expected: FAIL

**Step 3: Write FrontmatterConversionState**

```typescript
// packages/obsidian-plugin/src/frontmatter-conversion-state.ts
import type { ConversionStatePort } from '@petrify/core';
import { parseFrontmatter } from './utils/frontmatter.js';

export class FrontmatterConversionState implements ConversionStatePort {
  constructor(
    private readonly readFile: (path: string) => Promise<string>,
  ) {}

  async getLastConvertedMtime(id: string): Promise<number | undefined> {
    try {
      const content = await this.readFile(id);
      const meta = parseFrontmatter(content);
      return meta?.mtime;
    } catch {
      return undefined;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @petrify/obsidian-plugin test -- --run packages/obsidian-plugin/tests/frontmatter-conversion-state.test.ts`
Expected: PASS

**Step 5: main.ts 리팩토링**

```typescript
// packages/obsidian-plugin/src/main.ts
import { Notice, Plugin } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { ChokidarWatcher } from '@petrify/watcher-chokidar';
import { ConversionPipeline } from '@petrify/core';
import type { WatcherPort } from '@petrify/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DEFAULT_SETTINGS, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import { TesseractOcr } from './tesseract-ocr.js';
import { FrontmatterConversionState } from './frontmatter-conversion-state.js';
import { createFrontmatter } from './utils/frontmatter.js';

interface FileSystemAdapter extends DataAdapter {
  getBasePath(): string;
}

export default class PetrifyPlugin extends Plugin {
  settings!: PetrifySettings;
  private watchers: WatcherPort[] = [];
  private pipeline!: ConversionPipeline;
  private ocr: TesseractOcr | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.initializeOcr();
    this.initializePipeline();

    this.addSettingTab(
      new PetrifySettingsTab(this.app, this, {
        getSettings: () => this.settings,
        saveSettings: async (settings) => {
          this.settings = settings;
          await this.saveSettings();
          await this.restart();
        },
      })
    );

    await this.startWatchers();
  }

  async onunload(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    await this.ocr?.terminate();
  }

  private async initializeOcr(): Promise<void> {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'petrify');

    const workerPath = `file://${path.join(pluginDir, 'worker.min.js')}`;
    const corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/';

    this.ocr = new TesseractOcr({ lang: 'kor+eng', workerPath, corePath });
    await this.ocr.initialize();
  }

  private initializePipeline(): void {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();

    const conversionState = new FrontmatterConversionState(async (id: string) => {
      const outputPath = this.getOutputPathForId(id);
      const fullPath = path.join(vaultPath, outputPath);
      return fs.readFile(fullPath, 'utf-8');
    });

    this.pipeline = new ConversionPipeline(
      [new ViwoodsParser()],
      this.ocr,
      conversionState,
      { confidenceThreshold: this.settings.ocr.confidenceThreshold },
    );
  }

  private async startWatchers(): Promise<void> {
    for (const mapping of this.settings.watchMappings) {
      if (!mapping.watchDir) continue;

      const watcher = new ChokidarWatcher(mapping.watchDir);

      watcher.onFileChange(async (event) => {
        const result = await this.pipeline.handleFileChange(event);
        if (result) {
          const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
          const outputPath = this.getOutputPath(event.name, mapping.outputDir);
          await this.saveToVault(outputPath, frontmatter + result);
        }
      });

      watcher.onError((error) => {
        new Notice(`[Petrify] 오류: ${error.message}`);
        console.error('[Petrify]', error);
      });

      await watcher.start();
      this.watchers.push(watcher);
    }
  }

  private getOutputPathForId(id: string): string {
    const mapping = this.settings.watchMappings.find((m) => id.startsWith(m.watchDir));
    if (!mapping) return '';
    const fileName = path.basename(id, path.extname(id));
    return path.join(mapping.outputDir, `${fileName}.excalidraw.md`);
  }

  private getOutputPath(name: string, outputDir: string): string {
    const fileName = path.basename(name, path.extname(name));
    return path.join(outputDir, `${fileName}.excalidraw.md`);
  }

  private async saveToVault(outputPath: string, content: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.createFolder(dir);
    }
    if (await this.app.vault.adapter.exists(outputPath)) {
      await this.app.vault.adapter.write(outputPath, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
  }

  private async restart(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    this.watchers = [];
    this.initializePipeline();
    await this.startWatchers();
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

**Step 6: 삭제 대상 파일 제거**

```bash
rm packages/obsidian-plugin/src/watcher.ts
rm packages/obsidian-plugin/src/converter.ts
rm packages/obsidian-plugin/src/parser-registry.ts
rm packages/obsidian-plugin/tests/watcher.test.ts
rm packages/obsidian-plugin/tests/converter.test.ts
rm packages/obsidian-plugin/tests/parser-registry.test.ts
```

**Step 7: package.json 의존성 업데이트**

```json
// packages/obsidian-plugin/package.json - dependencies 수정
{
  "dependencies": {
    "@petrify/core": "workspace:*",
    "@petrify/parser-viwoods": "workspace:*",
    "@petrify/watcher-chokidar": "workspace:*",
    "tesseract.js": "^7.0.0"
  }
}
```

chokidar 직접 의존성 제거 (watcher-chokidar가 가져감).

**Step 8: typecheck 및 남은 테스트 실행**

Run: `pnpm install && pnpm typecheck && pnpm test`
Expected: ALL PASS

**Step 9: Commit**

```bash
git add -A
git commit -m "refactor: obsidian-plugin을 ConversionPipeline + WatcherPort 구조로 전환"
```

---

### Task 6: 전체 검증

**Step 1: 전체 빌드 & 테스트**

Run: `pnpm install && pnpm typecheck && pnpm test && pnpm build`
Expected: ALL PASS

**Step 2: 최종 패키지 구조 확인**

```
packages/
├── core/
│   └── src/
│       ├── ports/
│       │   ├── parser.ts
│       │   ├── ocr.ts
│       │   ├── watcher.ts            ← NEW
│       │   ├── conversion-state.ts   ← NEW
│       │   └── index.ts
│       ├── conversion-pipeline.ts    ← NEW
│       ├── api.ts
│       └── index.ts
├── parser/viwoods/
├── ocr/gutenye/
├── watcher/
│   └── chokidar/                     ← NEW
│       └── src/
│           ├── chokidar-watcher.ts
│           └── index.ts
└── obsidian-plugin/
    └── src/
        ├── main.ts                   ← MODIFIED
        ├── frontmatter-conversion-state.ts  ← NEW
        ├── tesseract-ocr.ts
        ├── settings.ts
        ├── settings-tab.ts
        └── utils/frontmatter.ts
```
