# @petrify/ocr-gutenye 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** @gutenye/ocr-browser를 래핑하여 OcrPort 인터페이스를 구현하는 @petrify/ocr-gutenye 패키지 생성

**Architecture:** 헥사고날 아키텍처의 어댑터로서 OcrPort 인터페이스를 구현. 브라우저 Canvas API로 스트로크를 이미지로 렌더링하고, @gutenye/ocr-browser로 OCR 수행. 모델은 최초 실행 시 다운로드.

**Tech Stack:** TypeScript, @gutenye/ocr-browser, vitest, tsup

---

## Task 1: 패키지 디렉토리 및 설정 파일 생성

**Files:**
- Create: `packages/ocr/gutenye/package.json`
- Create: `packages/ocr/gutenye/tsconfig.json`
- Create: `packages/ocr/gutenye/vitest.config.ts`

**Step 1: ocr 디렉토리 생성**

```bash
mkdir -p packages/ocr/gutenye/src packages/ocr/gutenye/tests
```

**Step 2: package.json 생성**

```json
{
  "name": "@petrify/ocr-gutenye",
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
    "@gutenye/ocr-browser": "^1.4.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 3: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 4: vitest.config.ts 생성**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 5: pnpm install 실행**

```bash
pnpm install
```

**Step 6: 커밋**

```bash
git add packages/ocr/gutenye/
git commit -m "chore: @petrify/ocr-gutenye 패키지 설정 파일 추가"
```

---

## Task 2: OcrResult 타입 확장 (confidence 임계값 지원)

**Files:**
- Modify: `packages/core/src/ports/ocr.ts`

**Step 1: 현재 OcrPort 인터페이스 확인**

현재 인터페이스:
```typescript
export interface OcrPort {
  recognize(image: ArrayBuffer): Promise<OcrResult>;
}
```

**Step 2: OcrOptions 타입 추가**

`packages/core/src/ports/ocr.ts` 수정:

```typescript
export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  regions: OcrRegion[];
}

export interface OcrOptions {
  /** confidence 임계값 (0-1). 이 값 이하인 영역은 무시 */
  confidenceThreshold?: number;
  /** 언어 코드 (예: 'korean', 'english') */
  language?: string;
}

export interface OcrPort {
  /** 이미지에서 텍스트 추출 */
  recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult>;
}
```

**Step 3: core index.ts에서 OcrOptions export 추가**

`packages/core/src/index.ts`에 추가:
```typescript
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ports/ocr.js';
```

**Step 4: ports/index.ts 수정**

```typescript
export type { ParserPort } from './parser.js';
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ocr.js';
```

**Step 5: 빌드 확인**

```bash
cd packages/core && pnpm build
```

**Step 6: 커밋**

```bash
git add packages/core/src/ports/ocr.ts packages/core/src/index.ts packages/core/src/ports/index.ts
git commit -m "feat(core): OcrOptions 타입 추가 및 OcrRegion에 confidence 필드 추가"
```

---

## Task 3: StrokeRenderer 구현 (스트로크 → Canvas 이미지)

**Files:**
- Create: `packages/ocr/gutenye/src/stroke-renderer.ts`
- Create: `packages/ocr/gutenye/tests/stroke-renderer.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/ocr/gutenye/tests/stroke-renderer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrokeRenderer } from '../src/stroke-renderer.js';
import type { Stroke } from '@petrify/core';

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
    await renderer.render(strokes, 200, 200);

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
    await renderer.render(strokes, 100, 100);

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
    await renderer.render(strokes, 100, 100);
    const buffer = await renderer.toArrayBuffer();

    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: FAIL - `Cannot find module '../src/stroke-renderer.js'`

**Step 3: StrokeRenderer 구현**

`packages/ocr/gutenye/src/stroke-renderer.ts`:

```typescript
import type { Stroke } from '@petrify/core';

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

    this.ctx.clearRect(0, 0, width, height);
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
```

**Step 4: 테스트 실행하여 통과 확인**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: PASS

**Step 5: 커밋**

```bash
git add packages/ocr/gutenye/src/stroke-renderer.ts packages/ocr/gutenye/tests/stroke-renderer.test.ts
git commit -m "feat(ocr-gutenye): StrokeRenderer 구현 - 스트로크를 Canvas 이미지로 변환"
```

---

## Task 4: ModelManager 구현 (모델 다운로드 및 캐시)

**Files:**
- Create: `packages/ocr/gutenye/src/model-manager.ts`
- Create: `packages/ocr/gutenye/tests/model-manager.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/ocr/gutenye/tests/model-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelManager, ModelConfig } from '../src/model-manager.js';

// IndexedDB 모킹
const mockStore: Record<string, ArrayBuffer> = {};
const mockTransaction = {
  objectStore: vi.fn(() => ({
    get: vi.fn((key: string) => ({
      result: mockStore[key],
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null as ((e: Event) => void) | null,
    })),
    put: vi.fn((value: ArrayBuffer, key: string) => {
      mockStore[key] = value;
      return {
        onsuccess: null as ((e: Event) => void) | null,
        onerror: null as ((e: Event) => void) | null,
      };
    }),
  })),
};

const mockDb = {
  transaction: vi.fn(() => mockTransaction),
  close: vi.fn(),
};

vi.stubGlobal('indexedDB', {
  open: vi.fn(() => ({
    result: mockDb,
    onsuccess: null as ((e: Event) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onupgradeneeded: null as ((e: Event) => void) | null,
  })),
});

// fetch 모킹
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
  })
));

describe('ModelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStore).forEach((key) => delete mockStore[key]);
  });

  it('모델 URL 설정', () => {
    const config: ModelConfig = {
      detectionUrl: 'https://example.com/det.onnx',
      recognitionUrl: 'https://example.com/rec.onnx',
      dictionaryUrl: 'https://example.com/dict.txt',
    };

    const manager = new ModelManager(config);
    expect(manager.getConfig()).toEqual(config);
  });

  it('한국어 모델 프리셋', () => {
    const manager = ModelManager.korean();
    const config = manager.getConfig();

    expect(config.recognitionUrl).toContain('korean');
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: FAIL - `Cannot find module '../src/model-manager.js'`

**Step 3: ModelManager 구현**

`packages/ocr/gutenye/src/model-manager.ts`:

```typescript
const BASE_URL = 'https://cdn.jsdelivr.net/npm/@�gutenye/ocr-models@1.4.2/dist';

export interface ModelConfig {
  detectionUrl: string;
  recognitionUrl: string;
  dictionaryUrl: string;
}

export interface ModelPaths {
  detectionPath: string;
  recognitionPath: string;
  dictionaryPath: string;
}

const KOREAN_CONFIG: ModelConfig = {
  detectionUrl: `${BASE_URL}/ch_PP-OCRv4_det_infer.onnx`,
  recognitionUrl: `${BASE_URL}/korean_PP-OCRv4_rec_infer.onnx`,
  dictionaryUrl: `${BASE_URL}/korean_dict.txt`,
};

const CHINESE_CONFIG: ModelConfig = {
  detectionUrl: `${BASE_URL}/ch_PP-OCRv4_det_infer.onnx`,
  recognitionUrl: `${BASE_URL}/ch_PP-OCRv4_rec_infer.onnx`,
  dictionaryUrl: `${BASE_URL}/ppocr_keys_v1.txt`,
};

const ENGLISH_CONFIG: ModelConfig = {
  detectionUrl: `${BASE_URL}/ch_PP-OCRv4_det_infer.onnx`,
  recognitionUrl: `${BASE_URL}/en_PP-OCRv4_rec_infer.onnx`,
  dictionaryUrl: `${BASE_URL}/en_dict.txt`,
};

export class ModelManager {
  private readonly config: ModelConfig;
  private cachedPaths: ModelPaths | null = null;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  static korean(): ModelManager {
    return new ModelManager(KOREAN_CONFIG);
  }

  static chinese(): ModelManager {
    return new ModelManager(CHINESE_CONFIG);
  }

  static english(): ModelManager {
    return new ModelManager(ENGLISH_CONFIG);
  }

  getConfig(): ModelConfig {
    return { ...this.config };
  }

  async ensureModels(): Promise<ModelPaths> {
    if (this.cachedPaths) {
      return this.cachedPaths;
    }

    const [detectionPath, recognitionPath, dictionaryPath] = await Promise.all([
      this.fetchAndCache('detection', this.config.detectionUrl),
      this.fetchAndCache('recognition', this.config.recognitionUrl),
      this.fetchAndCache('dictionary', this.config.dictionaryUrl),
    ]);

    this.cachedPaths = { detectionPath, recognitionPath, dictionaryPath };
    return this.cachedPaths;
  }

  private async fetchAndCache(key: string, url: string): Promise<string> {
    // 브라우저 환경에서는 URL을 직접 반환 (ONNX 런타임이 fetch 처리)
    // 캐싱은 브라우저의 HTTP 캐시에 의존
    return url;
  }
}
```

**Step 4: 테스트 실행하여 통과 확인**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: PASS

**Step 5: 커밋**

```bash
git add packages/ocr/gutenye/src/model-manager.ts packages/ocr/gutenye/tests/model-manager.test.ts
git commit -m "feat(ocr-gutenye): ModelManager 구현 - 한국어/영어/중국어 모델 프리셋"
```

---

## Task 5: GutenyeOcr 어댑터 구현 (OcrPort 인터페이스)

**Files:**
- Create: `packages/ocr/gutenye/src/gutenye-ocr.ts`
- Create: `packages/ocr/gutenye/tests/gutenye-ocr.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/ocr/gutenye/tests/gutenye-ocr.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GutenyeOcr } from '../src/gutenye-ocr.js';
import type { OcrPort, OcrResult } from '@petrify/core';

// @gutenye/ocr-browser 모킹
vi.mock('@gutenye/ocr-browser', () => ({
  default: {
    create: vi.fn(() =>
      Promise.resolve({
        detect: vi.fn(() =>
          Promise.resolve({
            text: [
              {
                text: '안녕하세요',
                score: 0.95,
                box: [[0, 0], [100, 0], [100, 30], [0, 30]],
              },
              {
                text: '테스트',
                score: 0.4,
                box: [[0, 50], [80, 50], [80, 80], [0, 80]],
              },
            ],
          })
        ),
      })
    ),
  },
}));

describe('GutenyeOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OcrPort 인터페이스 구현', async () => {
    const ocr: OcrPort = await GutenyeOcr.create();
    expect(ocr.recognize).toBeDefined();
  });

  it('이미지에서 텍스트 추출', async () => {
    const ocr = await GutenyeOcr.create();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image);

    expect(result.regions.length).toBe(2);
    expect(result.regions[0].text).toBe('안녕하세요');
    expect(result.regions[0].confidence).toBe(0.95);
  });

  it('confidence 임계값 적용', async () => {
    const ocr = await GutenyeOcr.create();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image, { confidenceThreshold: 0.5 });

    expect(result.regions.length).toBe(1);
    expect(result.regions[0].text).toBe('안녕하세요');
  });

  it('전체 텍스트 결합', async () => {
    const ocr = await GutenyeOcr.create();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image);

    expect(result.text).toBe('안녕하세요\n테스트');
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: FAIL - `Cannot find module '../src/gutenye-ocr.js'`

**Step 3: GutenyeOcr 구현**

`packages/ocr/gutenye/src/gutenye-ocr.ts`:

```typescript
import Ocr from '@gutenye/ocr-browser';
import type { OcrPort, OcrResult, OcrRegion, OcrOptions } from '@petrify/core';
import { ModelManager } from './model-manager.js';

interface TextLine {
  text: string;
  score: number;
  box: number[][];
}

interface DetectResult {
  text: TextLine[];
}

export class GutenyeOcr implements OcrPort {
  private ocr: Awaited<ReturnType<typeof Ocr.create>> | null = null;
  private readonly modelManager: ModelManager;

  private constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  static async create(modelManager?: ModelManager): Promise<GutenyeOcr> {
    const manager = modelManager ?? ModelManager.korean();
    const instance = new GutenyeOcr(manager);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    const paths = await this.modelManager.ensureModels();

    this.ocr = await Ocr.create({
      detectionPath: paths.detectionPath,
      recognitionPath: paths.recognitionPath,
      dictionaryPath: paths.dictionaryPath,
    });
  }

  async recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult> {
    if (!this.ocr) {
      throw new Error('OCR이 초기화되지 않았습니다');
    }

    const threshold = options?.confidenceThreshold ?? 0;
    const result: DetectResult = await this.ocr.detect(new Uint8Array(image));

    const regions: OcrRegion[] = result.text
      .filter((line) => line.score >= threshold)
      .map((line) => this.textLineToRegion(line));

    const text = regions.map((r) => r.text).join('\n');
    const avgConfidence =
      regions.length > 0
        ? regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length
        : 0;

    return {
      text,
      confidence: avgConfidence,
      regions,
    };
  }

  private textLineToRegion(line: TextLine): OcrRegion {
    const box = line.box;
    const minX = Math.min(...box.map((p) => p[0]));
    const maxX = Math.max(...box.map((p) => p[0]));
    const minY = Math.min(...box.map((p) => p[1]));
    const maxY = Math.max(...box.map((p) => p[1]));

    return {
      text: line.text,
      confidence: line.score,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
```

**Step 4: 테스트 실행하여 통과 확인**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: PASS

**Step 5: 커밋**

```bash
git add packages/ocr/gutenye/src/gutenye-ocr.ts packages/ocr/gutenye/tests/gutenye-ocr.test.ts
git commit -m "feat(ocr-gutenye): GutenyeOcr 어댑터 구현 - OcrPort 인터페이스 구현"
```

---

## Task 6: 패키지 공개 API 및 index.ts

**Files:**
- Create: `packages/ocr/gutenye/src/index.ts`
- Create: `packages/ocr/gutenye/src/exceptions.ts`

**Step 1: exceptions.ts 생성**

`packages/ocr/gutenye/src/exceptions.ts`:

```typescript
export class OcrInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrInitializationError';
  }
}

export class OcrRecognitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrRecognitionError';
  }
}
```

**Step 2: index.ts 생성**

`packages/ocr/gutenye/src/index.ts`:

```typescript
export { GutenyeOcr } from './gutenye-ocr.js';
export { StrokeRenderer } from './stroke-renderer.js';
export { ModelManager } from './model-manager.js';
export type { ModelConfig, ModelPaths } from './model-manager.js';
export { OcrInitializationError, OcrRecognitionError } from './exceptions.js';
```

**Step 3: 빌드 확인**

```bash
cd packages/ocr/gutenye && pnpm build
```

Expected: 성공, `dist/` 디렉토리에 파일 생성

**Step 4: 커밋**

```bash
git add packages/ocr/gutenye/src/index.ts packages/ocr/gutenye/src/exceptions.ts
git commit -m "feat(ocr-gutenye): 공개 API 및 예외 클래스 추가"
```

---

## Task 7: AGENTS.md 및 로드맵 업데이트

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/milestones/v1.0-roadmap.md`

**Step 1: AGENTS.md 패키지 구조 업데이트**

```markdown
### 패키지 구조

\`\`\`
packages/
├── core/                 # @petrify/core
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods
└── ocr/
    └── gutenye/          # @petrify/ocr-gutenye
\`\`\`

| 패키지 | 역할 |
|--------|------|
| `@petrify/core` | 중간 표현 모델, Excalidraw 변환, 포트 인터페이스 |
| `@petrify/parser-viwoods` | viwoods .note 파일 파서 (ParserPort 구현) |
| `@petrify/ocr-gutenye` | @gutenye/ocr-browser 래핑 OCR (OcrPort 구현) |
```

**Step 2: 로드맵 Phase 2 업데이트**

```markdown
## Phase 2: OCR 지원
- [x] OcrPort 상세 설계 (OcrOptions, confidence 필드 추가)
- [x] @petrify/ocr-gutenye 구현 (@gutenye/ocr-browser 래핑)
- [ ] 손글씨 인식 → Excalidraw 텍스트 요소 변환
```

**Step 3: 커밋**

```bash
git add AGENTS.md docs/milestones/v1.0-roadmap.md
git commit -m "docs: @petrify/ocr-gutenye 패키지 문서 업데이트"
```

---

## Task 8: 통합 테스트 (스트로크 → OCR → 텍스트)

**Files:**
- Create: `packages/ocr/gutenye/tests/integration.test.ts`

**Step 1: 통합 테스트 작성**

`packages/ocr/gutenye/tests/integration.test.ts`:

```typescript
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
          Promise.resolve({
            text: [
              {
                text: '테스트 텍스트',
                score: 0.9,
                box: [[10, 10], [200, 10], [200, 50], [10, 50]],
              },
            ],
          })
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
    expect(result.regions[0].confidence).toBe(0.9);
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
    const result = await ocr.recognize(imageBuffer, { confidenceThreshold: 0.95 });

    // confidence 0.9 < 0.95 이므로 필터링됨
    expect(result.regions.length).toBe(0);
  });
});
```

**Step 2: 테스트 실행**

```bash
cd packages/ocr/gutenye && pnpm test
```

Expected: PASS

**Step 3: 커밋**

```bash
git add packages/ocr/gutenye/tests/integration.test.ts
git commit -m "test(ocr-gutenye): 스트로크 → OCR 통합 테스트 추가"
```

---

## 요약

| Task | 설명 | 예상 시간 |
|------|------|----------|
| 1 | 패키지 설정 파일 | - |
| 2 | OcrPort 타입 확장 | - |
| 3 | StrokeRenderer 구현 | - |
| 4 | ModelManager 구현 | - |
| 5 | GutenyeOcr 어댑터 | - |
| 6 | 공개 API | - |
| 7 | 문서 업데이트 | - |
| 8 | 통합 테스트 | - |

**다음 단계 (Phase 2b):**
- 스트로크 그룹별 OCR 처리
- Excalidraw 텍스트 요소 변환 통합
