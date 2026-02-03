# Weakness Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 프로젝트 약점 4가지 개선 - OCR 파이프라인 완성, 에러 처리 일관성, 매직 넘버 문서화, 테스트 설정 통일

**Architecture:** StrokeRenderer를 core로 이동하여 헥사고날 아키텍처 준수, 에러 처리 기준을 AGENTS.md에 명문화, vitest 설정을 루트에서 통일 관리

**Tech Stack:** TypeScript, Vitest, pnpm workspace

---

## Task 1: 테스트 설정 통일

**Files:**
- Modify: `vitest.config.ts` (루트)
- Modify: `packages/core/vitest.config.ts`
- Modify: `packages/ocr/gutenye/vitest.config.ts`

**Step 1: 루트 vitest.config.ts에서 globals: false로 변경**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
  },
});
```

**Step 2: packages/core/vitest.config.ts에서 globals 설정 제거 (루트 설정 상속)**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {},
  resolve: {
    alias: {
      '@petrify/parser-viwoods': resolve(__dirname, '../parser/viwoods/src/index.ts'),
    },
  },
});
```

**Step 3: packages/ocr/gutenye/vitest.config.ts에서 globals 설정 제거**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {},
});
```

**Step 4: 전체 테스트 실행하여 확인**

Run: `pnpm test`
Expected: 모든 테스트 PASS (이미 명시적 import 사용 중)

**Step 5: 커밋**

```bash
git add vitest.config.ts packages/core/vitest.config.ts packages/ocr/gutenye/vitest.config.ts
git commit -m "chore: vitest globals: false로 통일"
```

---

## Task 2: 루트 AGENTS.md에 규칙 추가

**Files:**
- Modify: `CLAUDE.md` (루트 AGENTS.md)

**Step 1: 에러 처리 기준 추가**

DO 섹션에 추가:
```markdown
- 필수 데이터 파싱 실패 시 명시적 예외 throw
  ```typescript
  throw new ParseError('Failed to parse stroke data');
  ```

- 선택적 데이터 파싱 실패 시 기본값 반환 + 로깅
  ```typescript
  // 선택적 메타데이터 - 없어도 기본 동작 가능
  } catch {
    return {};
  }
  ```
```

DON'T 섹션에 추가:
```markdown
- 필수 데이터 실패를 silent fail로 처리하지 않기
```

**Step 2: 테스트 설정 규칙 추가**

DO 섹션에 추가:
```markdown
- vitest에서 describe, it, expect 등 명시적으로 import
  ```typescript
  import { describe, it, expect } from 'vitest';
  ```
```

DON'T 섹션에 추가:
```markdown
- vitest globals: true 사용하지 않기
```

**Step 3: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: AGENTS.md에 에러 처리 및 테스트 설정 규칙 추가"
```

---

## Task 3: 매직 넘버 문서화 - parser.ts

**Files:**
- Modify: `packages/parser/viwoods/src/parser.ts:21-25`

**Step 1: 매직 넘버에 JSDoc 주석 추가**

```typescript
export class NoteParser {
  /** Viwoods PageResource 리소스 타입: mainBmp (배경 이미지) */
  static readonly RESOURCE_TYPE_MAINBMP = 1;
  /** Viwoods PageResource 리소스 타입: path (스트로크 경로) */
  static readonly RESOURCE_TYPE_PATH = 7;
  /**
   * 스트로크 구분 시간 임계값 (ms)
   * Viwoods 파일 분석 결과: 동일 스트로크 내 포인트 간격은 최대 5ms, 6ms 이상이면 별도 스트로크
   */
  static readonly DEFAULT_GAP_THRESHOLD = 6;
  private static readonly DEFAULT_COLOR = '#000000';
  /** 기본 알파값 (0-255), 완전 불투명 */
  private static readonly DEFAULT_ALPHA = 255;
```

**Step 2: parsePageResource의 catch 블록에 주석 추가**

`packages/parser/viwoods/src/parser.ts:120-122`:
```typescript
    } catch {
      // PageResource는 선택적 메타데이터 - 파싱 실패해도 mainBmp 자동 매핑 또는 기본 색상으로 진행 가능
      return {};
    }
```

**Step 3: 테스트 실행**

Run: `pnpm --filter @petrify/parser-viwoods test`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/parser/viwoods/src/parser.ts
git commit -m "docs: parser.ts 매직 넘버 문서화"
```

---

## Task 4: 매직 넘버 문서화 - generator.ts

**Files:**
- Modify: `packages/core/src/excalidraw/generator.ts:43-48`

**Step 1: 매직 넘버에 JSDoc 주석 추가**

```typescript
export class ExcalidrawGenerator {
  /** 페이지 간 세로 간격 (px) */
  static readonly PAGE_GAP = 100;
  /**
   * 스트로크 폭 변환 비율
   * Viwoods 스트로크 폭을 Excalidraw에 맞게 축소 (width / 6)
   */
  static readonly STROKE_WIDTH_DIVISOR = 6;
  /** 최소 스트로크 폭 (px) - 0이 되지 않도록 보장 */
  static readonly MIN_STROKE_WIDTH = 1;
  /**
   * 일정한 획 굵기를 위한 압력 값
   * 실험적으로 결정: 0.5가 원본과 가장 유사한 결과
   */
  private static readonly PRESSURE_VALUE = 0.5;
  /** Excalidraw seed 최대값 (Int32 최대값) */
  private static readonly MAX_SEED = 2147483647;
```

**Step 2: 테스트 실행**

Run: `pnpm --filter @petrify/core test`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/core/src/excalidraw/generator.ts
git commit -m "docs: generator.ts 매직 넘버 문서화"
```

---

## Task 5: StrokeRenderer를 core로 이동

**Files:**
- Create: `packages/core/src/rendering/stroke-renderer.ts`
- Create: `packages/core/src/rendering/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/ocr/gutenye/src/index.ts`
- Delete: `packages/ocr/gutenye/src/stroke-renderer.ts`
- Move: `packages/ocr/gutenye/tests/stroke-renderer.test.ts` → `packages/core/tests/rendering/stroke-renderer.test.ts`

**Step 1: core에 rendering 디렉토리 생성 및 stroke-renderer.ts 복사**

`packages/core/src/rendering/stroke-renderer.ts`:
```typescript
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

**Step 2: rendering/index.ts 생성**

`packages/core/src/rendering/index.ts`:
```typescript
export { StrokeRenderer } from './stroke-renderer.js';
```

**Step 3: core/index.ts에 export 추가**

`packages/core/src/index.ts`에 추가:
```typescript
export { StrokeRenderer } from './rendering/index.js';
```

**Step 4: ocr-gutenye/src/index.ts에서 StrokeRenderer를 core에서 re-export**

`packages/ocr/gutenye/src/index.ts`:
```typescript
export { GutenyeOcr } from './gutenye-ocr.js';
export { StrokeRenderer } from '@petrify/core';
export { ModelManager } from './model-manager.js';
export type { ModelConfig, ModelPaths } from './model-manager.js';
```

**Step 5: ocr-gutenye/src/stroke-renderer.ts 삭제**

Run: `rm packages/ocr/gutenye/src/stroke-renderer.ts`

**Step 6: 테스트 파일 이동**

Run: `mkdir -p packages/core/tests/rendering && mv packages/ocr/gutenye/tests/stroke-renderer.test.ts packages/core/tests/rendering/`

**Step 7: 이동된 테스트 파일 import 경로 수정**

`packages/core/tests/rendering/stroke-renderer.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrokeRenderer } from '../../src/rendering/stroke-renderer.js';
import type { Stroke } from '../../src/models/index.js';

// 나머지 동일...
```

**Step 8: 전체 테스트 실행**

Run: `pnpm test`
Expected: PASS

**Step 9: 커밋**

```bash
git add packages/core/src/rendering/ packages/core/src/index.ts packages/core/tests/rendering/
git add packages/ocr/gutenye/src/index.ts
git rm packages/ocr/gutenye/src/stroke-renderer.ts packages/ocr/gutenye/tests/stroke-renderer.test.ts
git commit -m "refactor: StrokeRenderer를 core로 이동"
```

---

## Task 6: OCR 파이프라인 연결

**Files:**
- Modify: `packages/core/src/api.ts:33-56`

**Step 1: convertToMdWithOcr에서 StrokeRenderer 사용하도록 수정**

```typescript
import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import { ExcalidrawGenerator } from './excalidraw/generator.js';
import { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
import { StrokeRenderer } from './rendering/index.js';
import type { ExcalidrawData } from './excalidraw/generator.js';
import type { OcrTextResult } from './excalidraw/md-generator.js';
import { filterOcrByConfidence } from './ocr/filter.js';

export interface ConvertOptions {
  ocrConfidenceThreshold?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 50;

export async function convert(
  data: ArrayBuffer,
  parser: ParserPort
): Promise<ExcalidrawData> {
  const note = await parser.parse(data);
  const generator = new ExcalidrawGenerator();
  return generator.generate(note);
}

export async function convertToMd(
  data: ArrayBuffer,
  parser: ParserPort
): Promise<string> {
  const excalidrawData = await convert(data, parser);
  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData);
}

export async function convertToMdWithOcr(
  data: ArrayBuffer,
  parser: ParserPort,
  ocr: OcrPort,
  options?: ConvertOptions
): Promise<string> {
  const threshold = options?.ocrConfidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const note = await parser.parse(data);
  const generator = new ExcalidrawGenerator();
  const excalidrawData = generator.generate(note);

  // TODO(2026-02-03, minjun.jo): 다중 페이지 OCR 처리 구현 필요
  // 현재는 첫 페이지만 처리
  const firstPage = note.pages[0];
  if (!firstPage || firstPage.strokes.length === 0) {
    const mdGenerator = new ExcalidrawMdGenerator();
    return mdGenerator.generate(excalidrawData);
  }

  const renderer = new StrokeRenderer();
  renderer.render(firstPage.strokes, firstPage.width, firstPage.height);
  const imageBuffer = await renderer.toArrayBuffer();

  const ocrResult = await ocr.recognize(imageBuffer);
  const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);

  const ocrResults: OcrTextResult[] = filteredTexts.length > 0
    ? [{ pageIndex: 0, texts: filteredTexts }]
    : [];

  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData, undefined, ocrResults);
}
```

**Step 2: 테스트 실행**

Run: `pnpm --filter @petrify/core test`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/core/src/api.ts
git commit -m "feat: OCR 파이프라인에 StrokeRenderer 연결"
```

---

## Task 7: 최종 검증

**Step 1: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

**Step 2: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 PASS

**Step 3: 린트 (있다면)**

Run: `pnpm lint`
Expected: 에러 없음
