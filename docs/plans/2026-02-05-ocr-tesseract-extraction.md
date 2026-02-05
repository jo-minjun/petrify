# OCR Tesseract 어댑터 추출 및 gutenye 제거 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** TesseractOcr를 obsidian-plugin에서 `@petrify/ocr-tesseract` 패키지로 추출하고, 사용 불가능한 `@petrify/ocr-gutenye`를 완전 삭제한다.

**Architecture:** 헥사고날 아키텍처의 어댑터 패턴. TesseractOcr는 OcrPort 구현체로서 독립 패키지로 분리. obsidian-plugin은 이 패키지를 의존성으로 사용.

**Tech Stack:** TypeScript, tesseract.js ^7.0.0, vitest, tsup

---

### Task 1: `@petrify/ocr-tesseract` 패키지 생성

**Files:**
- Create: `packages/ocr/tesseract/package.json`
- Create: `packages/ocr/tesseract/tsconfig.json`
- Create: `packages/ocr/tesseract/src/tesseract-ocr.ts`
- Create: `packages/ocr/tesseract/src/index.ts`

**Step 1: 패키지 설정 파일 생성**

`packages/ocr/tesseract/package.json`:
```json
{
  "name": "@petrify/ocr-tesseract",
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
    "tesseract.js": "^7.0.0"
  }
}
```

`packages/ocr/tesseract/tsconfig.json`:
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

**Step 2: tesseract-ocr.ts를 obsidian-plugin에서 이동**

`packages/ocr/tesseract/src/tesseract-ocr.ts` — obsidian-plugin의 `src/tesseract-ocr.ts`와 동일한 내용:
```typescript
import Tesseract, { createWorker, type Worker, type Line } from 'tesseract.js';
import type { OcrPort, OcrResult, OcrRegion, OcrOptions } from '@petrify/core';

export interface TesseractOcrConfig {
  lang: string;
  workerPath?: string;
  corePath?: string;
  langPath?: string;
}

export class TesseractOcr implements OcrPort {
  private worker: Worker | null = null;
  private readonly config: TesseractOcrConfig;

  constructor(config: Partial<TesseractOcrConfig> = {}) {
    this.config = {
      lang: config.lang ?? 'kor+eng',
      workerPath: config.workerPath,
      corePath: config.corePath,
      langPath: config.langPath,
    };
  }

  async initialize(): Promise<void> {
    this.worker = await createWorker(this.config.lang, Tesseract.OEM.LSTM_ONLY, {
      workerPath: this.config.workerPath,
      corePath: this.config.corePath,
      langPath: this.config.langPath,
    });
  }

  async recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult> {
    if (!this.worker) {
      await this.initialize();
    }

    const result = await this.worker!.recognize(Buffer.from(image));
    const threshold = options?.confidenceThreshold ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any;
    const lines = (data.lines ?? []) as Line[];
    const allRegions: OcrRegion[] = lines.map((line) => ({
      text: line.text.trim(),
      confidence: line.confidence ?? 0,
      x: line.bbox.x0,
      y: line.bbox.y0,
      width: line.bbox.x1 - line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0,
    }));

    const regions = allRegions.filter(
      (r) => r.confidence == null || r.confidence >= threshold
    );
    const text = regions.map((r) => r.text).join('\n');

    const regionsWithConfidence = regions.filter((r) => r.confidence != null);
    const avgConfidence =
      regionsWithConfidence.length > 0
        ? regionsWithConfidence.reduce((sum, r) => sum + r.confidence!, 0) / regionsWithConfidence.length
        : undefined;

    return {
      text,
      confidence: avgConfidence,
      regions,
    };
  }

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}
```

**Step 3: index.ts 생성**

`packages/ocr/tesseract/src/index.ts`:
```typescript
export { TesseractOcr } from './tesseract-ocr.js';
export type { TesseractOcrConfig } from './tesseract-ocr.js';
```

**Step 4: pnpm install 실행**

Run: `pnpm install`

**Step 5: 테스트 작성 및 실행**

`packages/ocr/tesseract/tests/tesseract-ocr.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TesseractOcr } from '../src/tesseract-ocr.js';

vi.mock('tesseract.js', () => {
  const mockWorker = {
    recognize: vi.fn(),
    terminate: vi.fn(),
  };
  return {
    default: { OEM: { LSTM_ONLY: 1 } },
    createWorker: vi.fn().mockResolvedValue(mockWorker),
    __mockWorker: mockWorker,
  };
});

function getMockWorker() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('tesseract.js').__mockWorker;
}

describe('TesseractOcr', () => {
  let ocr: TesseractOcr;

  beforeEach(() => {
    vi.clearAllMocks();
    ocr = new TesseractOcr({ lang: 'kor+eng' });
  });

  it('recognize는 OcrResult를 반환한다', async () => {
    const mockWorker = getMockWorker();
    mockWorker.recognize.mockResolvedValue({
      data: {
        lines: [
          {
            text: '안녕하세요',
            confidence: 95,
            bbox: { x0: 0, y0: 0, x1: 100, y1: 20 },
          },
        ],
      },
    });

    const result = await ocr.recognize(new ArrayBuffer(8));

    expect(result.text).toBe('안녕하세요');
    expect(result.confidence).toBe(95);
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]).toEqual({
      text: '안녕하세요',
      confidence: 95,
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
  });

  it('confidenceThreshold 미만 영역은 필터링된다', async () => {
    const mockWorker = getMockWorker();
    mockWorker.recognize.mockResolvedValue({
      data: {
        lines: [
          { text: '높은 신뢰도', confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
          { text: '낮은 신뢰도', confidence: 30, bbox: { x0: 0, y0: 20, x1: 100, y1: 40 } },
        ],
      },
    });

    const result = await ocr.recognize(new ArrayBuffer(8), { confidenceThreshold: 50 });

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].text).toBe('높은 신뢰도');
  });

  it('terminate는 worker를 정리한다', async () => {
    const mockWorker = getMockWorker();
    mockWorker.recognize.mockResolvedValue({ data: { lines: [] } });

    await ocr.recognize(new ArrayBuffer(8));
    await ocr.terminate();

    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it('기본 lang은 kor+eng이다', async () => {
    const defaultOcr = new TesseractOcr();
    const mockWorker = getMockWorker();
    mockWorker.recognize.mockResolvedValue({ data: { lines: [] } });

    await defaultOcr.recognize(new ArrayBuffer(8));

    const { createWorker } = await import('tesseract.js');
    expect(createWorker).toHaveBeenCalledWith('kor+eng', 1, expect.any(Object));
  });
});
```

Run: `pnpm test --filter @petrify/ocr-tesseract`
Expected: PASS

**Step 6: 커밋**

```bash
git add packages/ocr/tesseract/
git commit -m "feat: @petrify/ocr-tesseract 패키지 생성 (OcrPort 구현)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: obsidian-plugin에서 TesseractOcr 참조 전환

**Files:**
- Delete: `packages/obsidian-plugin/src/tesseract-ocr.ts`
- Modify: `packages/obsidian-plugin/src/main.ts:11` — import 경로 변경
- Modify: `packages/obsidian-plugin/package.json` — 의존성 변경

**Step 1: package.json 수정**

`packages/obsidian-plugin/package.json`에서:
- `"tesseract.js": "^7.0.0"` 제거
- `"@petrify/ocr-tesseract": "workspace:*"` 추가

```json
{
  "dependencies": {
    "@petrify/core": "workspace:*",
    "@petrify/parser-viwoods": "workspace:*",
    "@petrify/watcher-chokidar": "workspace:*",
    "@petrify/ocr-tesseract": "workspace:*"
  }
}
```

**Step 2: main.ts import 변경**

`packages/obsidian-plugin/src/main.ts:11`:
```typescript
// Before:
import { TesseractOcr } from './tesseract-ocr.js';

// After:
import { TesseractOcr } from '@petrify/ocr-tesseract';
```

**Step 3: tesseract-ocr.ts 삭제**

Delete: `packages/obsidian-plugin/src/tesseract-ocr.ts`

**Step 4: pnpm install 실행**

Run: `pnpm install`

**Step 5: 타입 체크**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: PASS (에러 없음)

**Step 6: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "refactor: obsidian-plugin의 TesseractOcr를 @petrify/ocr-tesseract로 전환

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3: `@petrify/ocr-gutenye` 완전 삭제

**Files:**
- Delete: `packages/ocr/gutenye/` (전체 디렉토리)

**Step 1: 디렉토리 삭제**

Run: `rm -rf packages/ocr/gutenye/`

**Step 2: pnpm install 실행**

Run: `pnpm install`

**Step 3: 전체 테스트 실행**

Run: `pnpm test`
Expected: 모든 테스트 PASS (gutenye 테스트만 사라짐)

**Step 4: 커밋**

```bash
git rm -r packages/ocr/gutenye/
git commit -m "refactor: @petrify/ocr-gutenye 패키지 완전 삭제

Obsidian/Electron 환경에서 onnxruntime-web Worker 로딩 문제로 사용 불가능.
Tesseract.js 기반 @petrify/ocr-tesseract로 대체 완료.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4: 설정 및 UI에서 gutenye 참조 제거

**Files:**
- Modify: `packages/obsidian-plugin/src/settings.ts:12,25` — provider 타입 및 기본값 변경
- Modify: `packages/obsidian-plugin/src/settings-tab.ts:93,98` — 드롭다운 옵션 변경
- Modify: `packages/obsidian-plugin/tests/settings.test.ts:10` — 테스트 업데이트

**Step 1: settings.ts 수정**

`packages/obsidian-plugin/src/settings.ts`:
```typescript
// Before:
provider: 'gutenye' | 'google-vision' | 'azure-ocr';
// After:
provider: 'tesseract' | 'google-vision' | 'azure-ocr';

// Before:
provider: 'gutenye',
// After:
provider: 'tesseract',
```

**Step 2: settings-tab.ts 수정**

`packages/obsidian-plugin/src/settings-tab.ts:91-102`:
```typescript
// Before:
.addOption('gutenye', 'Gutenye (Local)')
// After:
.addOption('tesseract', 'Tesseract.js (Local)')

// Before:
settings.ocr.provider = value as 'gutenye' | 'google-vision' | 'azure-ocr';
// After:
settings.ocr.provider = value as 'tesseract' | 'google-vision' | 'azure-ocr';
```

**Step 3: settings.test.ts 수정**

`packages/obsidian-plugin/tests/settings.test.ts:10`:
```typescript
// Before:
expect(DEFAULT_SETTINGS.ocr.provider).toBe('gutenye');
// After:
expect(DEFAULT_SETTINGS.ocr.provider).toBe('tesseract');
```

**Step 4: 테스트 실행**

Run: `pnpm test`
Expected: 모든 테스트 PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/settings.ts packages/obsidian-plugin/src/settings-tab.ts packages/obsidian-plugin/tests/settings.test.ts
git commit -m "refactor: OCR provider 설정에서 gutenye를 tesseract로 변경

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5: 프로젝트 설정 파일 업데이트

**Files:**
- Modify: `tsconfig.json:16` — paths에서 gutenye → tesseract
- Modify: `CLAUDE.md` — 패키지 구조 및 테이블 업데이트
- Modify: `README.md` — gutenye 참조를 tesseract로 변경

**Step 1: tsconfig.json paths 수정**

`tsconfig.json`:
```json
{
  "paths": {
    "@petrify/core": ["packages/core/src/index.ts"],
    "@petrify/parser-viwoods": ["packages/parser/viwoods/src/index.ts"],
    "@petrify/ocr-tesseract": ["packages/ocr/tesseract/src/index.ts"],
    "@petrify/watcher-chokidar": ["packages/watcher/chokidar/src/index.ts"]
  }
}
```

**Step 2: CLAUDE.md 패키지 구조 수정**

패키지 구조에서:
```
packages/
├── core/                 # @petrify/core
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods
└── ocr/
    └── tesseract/        # @petrify/ocr-tesseract
```

테이블에서:
```
| `@petrify/ocr-tesseract` | Tesseract.js 래핑 OCR (OcrPort 구현) |
```

paths에서:
```json
"@petrify/ocr-tesseract": ["packages/ocr/tesseract/src/index.ts"]
```

**Step 3: README.md 수정**

- 소개 섹션: `@gutenye/ocr-browser (PaddleOCR 기반), Tesseract.js` → `Tesseract.js`
- 지원 현황 테이블: `@gutenye/ocr-browser ✅` 행 제거
- 아키텍처 다이어그램: `gutenye` → `tesseract`
- 패키지 개별 설치: `@petrify/ocr-gutenye` → `@petrify/ocr-tesseract`
- OCR Provider 설정: `gutenye (로컬)` → `tesseract (로컬)`
- 패키지 구조: `gutenye/` → `tesseract/`
- 의존성 다이어그램: `gutenye` → `tesseract`

**Step 4: 전체 빌드 및 테스트 실행**

Run: `pnpm test`
Expected: 모든 테스트 PASS

**Step 5: 커밋**

```bash
git add tsconfig.json CLAUDE.md README.md
git commit -m "docs: gutenye 참조를 tesseract로 일괄 변경

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 최종 패키지 구조

```
packages/
├── core/                 # @petrify/core (포트 인터페이스 + ConversionPipeline)
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods (ParserPort 구현)
├── ocr/
│   └── tesseract/        # @petrify/ocr-tesseract (OcrPort 구현) ← NEW
├── watcher/
│   └── chokidar/         # @petrify/watcher-chokidar (WatcherPort 구현)
└── obsidian-plugin/      # Obsidian 플러그인 (조립 + UI)
```
