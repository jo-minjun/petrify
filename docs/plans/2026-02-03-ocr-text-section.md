# OCR Text Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** OCR 인식 텍스트를 `.excalidraw.md` 파일의 `## OCR Text` 섹션에 포함하여 Obsidian 검색 가능하게 함

**Architecture:** `ExcalidrawMdGenerator`를 확장하여 OCR 결과를 받아 `## OCR Text` 섹션을 생성. 이 섹션은 `# Excalidraw Data` 앞(back-of-note 영역)에 배치되어 Excalidraw 플러그인이 저장해도 삭제되지 않음. elements 배열에는 text 요소를 추가하지 않아 캔버스에 표시되지 않음.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: OcrTextResult 타입 정의

**Files:**
- Modify: `packages/core/src/excalidraw/md-generator.ts:1-3`

**Step 1: Write the failing test**

`packages/core/tests/excalidraw/excalidraw-md.test.ts` 파일 끝에 추가:

```typescript
describe('OCR Text Section', () => {
  it('OcrTextResult 타입이 export됨', async () => {
    const { OcrTextResult } = await import('../../src/excalidraw');
    // 타입만 확인하므로 undefined여도 됨 (interface는 런타임에 없음)
    // 대신 실제 사용 테스트로 검증
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: PASS (타입은 런타임 체크 불가하므로 다음 단계에서 실제 사용 테스트)

**Step 3: Write OcrTextResult interface**

`packages/core/src/excalidraw/md-generator.ts` 상단에 추가:

```typescript
import LZString from 'lz-string';
import type { ExcalidrawData } from './generator.js';

export interface OcrTextResult {
  pageIndex: number;
  texts: string[];
}
```

**Step 4: Export from index.ts**

`packages/core/src/excalidraw/index.ts`에 추가:

```typescript
export { ExcalidrawGenerator } from './generator.js';
export type { ExcalidrawData, ExcalidrawElement } from './generator.js';
export { ExcalidrawMdGenerator } from './md-generator.js';
export type { OcrTextResult } from './md-generator.js';
```

**Step 5: Run type check**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/excalidraw/md-generator.ts packages/core/src/excalidraw/index.ts
git commit -m "feat(core): OcrTextResult 타입 정의"
```

---

### Task 2: formatOcrSection 메서드 구현 - 빈 결과 처리

**Files:**
- Modify: `packages/core/src/excalidraw/md-generator.ts`
- Test: `packages/core/tests/excalidraw/excalidraw-md.test.ts`

**Step 1: Write the failing test**

`packages/core/tests/excalidraw/excalidraw-md.test.ts`의 `describe('OCR Text Section')` 안에 추가:

```typescript
  it('OCR 결과가 없으면 빈 ## OCR Text 섹션 생성', () => {
    const generator = new ExcalidrawMdGenerator();
    const result = (generator as any).formatOcrSection(undefined);
    expect(result).toBe('## OCR Text\n\n');
  });

  it('OCR 결과가 빈 배열이면 빈 ## OCR Text 섹션 생성', () => {
    const generator = new ExcalidrawMdGenerator();
    const result = (generator as any).formatOcrSection([]);
    expect(result).toBe('## OCR Text\n\n');
  });
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: FAIL with "formatOcrSection is not a function"

**Step 3: Write minimal implementation**

`packages/core/src/excalidraw/md-generator.ts`에 메서드 추가:

```typescript
  private formatOcrSection(ocrResults?: OcrTextResult[]): string {
    let section = '## OCR Text\n';
    if (!ocrResults || ocrResults.length === 0) {
      return section + '\n';
    }
    return section + '\n';
  }
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/excalidraw/md-generator.ts packages/core/tests/excalidraw/excalidraw-md.test.ts
git commit -m "feat(core): formatOcrSection 빈 결과 처리"
```

---

### Task 3: formatOcrSection 메서드 구현 - 페이지별 텍스트 포맷팅

**Files:**
- Modify: `packages/core/src/excalidraw/md-generator.ts`
- Test: `packages/core/tests/excalidraw/excalidraw-md.test.ts`

**Step 1: Write the failing test**

`describe('OCR Text Section')` 안에 추가:

```typescript
  it('단일 페이지 OCR 결과 포맷팅', () => {
    const generator = new ExcalidrawMdGenerator();
    const ocrResults: OcrTextResult[] = [
      { pageIndex: 0, texts: ['첫 번째 텍스트', '두 번째 텍스트'] }
    ];
    const result = (generator as any).formatOcrSection(ocrResults);
    expect(result).toBe(
      '## OCR Text\n' +
      '<!-- Page 1 -->\n' +
      '첫 번째 텍스트\n' +
      '두 번째 텍스트\n' +
      '\n'
    );
  });

  it('여러 페이지 OCR 결과 포맷팅', () => {
    const generator = new ExcalidrawMdGenerator();
    const ocrResults: OcrTextResult[] = [
      { pageIndex: 0, texts: ['페이지1 텍스트'] },
      { pageIndex: 1, texts: ['페이지2 텍스트A', '페이지2 텍스트B'] }
    ];
    const result = (generator as any).formatOcrSection(ocrResults);
    expect(result).toBe(
      '## OCR Text\n' +
      '<!-- Page 1 -->\n' +
      '페이지1 텍스트\n' +
      '<!-- Page 2 -->\n' +
      '페이지2 텍스트A\n' +
      '페이지2 텍스트B\n' +
      '\n'
    );
  });
```

테스트 파일 상단에 import 추가:

```typescript
import type { OcrTextResult } from '../../src/excalidraw';
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: FAIL - 예상 출력과 다름

**Step 3: Write full implementation**

`formatOcrSection` 메서드 수정:

```typescript
  private formatOcrSection(ocrResults?: OcrTextResult[]): string {
    let section = '## OCR Text\n';
    if (!ocrResults || ocrResults.length === 0) {
      return section + '\n';
    }
    for (const result of ocrResults) {
      section += `<!-- Page ${result.pageIndex + 1} -->\n`;
      section += result.texts.join('\n') + '\n';
    }
    return section + '\n';
  }
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/excalidraw/md-generator.ts packages/core/tests/excalidraw/excalidraw-md.test.ts
git commit -m "feat(core): formatOcrSection 페이지별 포맷팅 구현"
```

---

### Task 4: generate() 메서드에 ocrResults 파라미터 추가

**Files:**
- Modify: `packages/core/src/excalidraw/md-generator.ts`
- Test: `packages/core/tests/excalidraw/excalidraw-md.test.ts`

**Step 1: Write the failing test**

`describe('OCR Text Section')` 안에 추가:

```typescript
  it('generate()에 OCR 결과 전달하면 ## OCR Text 섹션 포함', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };
    const ocrResults: OcrTextResult[] = [
      { pageIndex: 0, texts: ['테스트 텍스트'] }
    ];

    const md = generator.generate(data, undefined, ocrResults);

    expect(md).toContain('## OCR Text');
    expect(md).toContain('<!-- Page 1 -->');
    expect(md).toContain('테스트 텍스트');
    // OCR 섹션이 # Excalidraw Data 앞에 있는지 확인
    const ocrIndex = md.indexOf('## OCR Text');
    const excalidrawIndex = md.indexOf('# Excalidraw Data');
    expect(ocrIndex).toBeLessThan(excalidrawIndex);
  });

  it('generate()에 OCR 결과 없으면 빈 ## OCR Text 섹션', () => {
    const generator = new ExcalidrawMdGenerator();
    const data: ExcalidrawData = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {},
    };

    const md = generator.generate(data);

    expect(md).toContain('## OCR Text');
    expect(md).not.toContain('<!-- Page');
  });
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: FAIL - OCR 섹션이 출력에 없음

**Step 3: Write implementation**

`generate()` 메서드 시그니처 및 본문 수정:

```typescript
  generate(
    excalidrawData: ExcalidrawData,
    embeddedFiles?: Record<string, string>,
    ocrResults?: OcrTextResult[]
  ): string {
    const compressed = LZString.compressToBase64(JSON.stringify(excalidrawData));
    const embeddedSection = this.formatEmbeddedFiles(embeddedFiles);
    const ocrSection = this.formatOcrSection(ocrResults);

    return `---
excalidraw-plugin: parsed
tags:
---

${ocrSection}
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run excalidraw-md.test.ts`
Expected: PASS

**Step 5: Run all tests to ensure no regression**

Run: `cd packages/core && pnpm test -- --run`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/core/src/excalidraw/md-generator.ts packages/core/tests/excalidraw/excalidraw-md.test.ts
git commit -m "feat(core): generate()에 ocrResults 파라미터 추가"
```

---

### Task 5: filterOcrByConfidence 유틸 함수 구현

**Files:**
- Create: `packages/core/src/ocr/filter.ts`
- Create: `packages/core/tests/ocr/filter.test.ts`

**Step 1: Write the failing test**

`packages/core/tests/ocr/filter.test.ts` 파일 생성:

```typescript
import { describe, it, expect } from 'vitest';
import { filterOcrByConfidence } from '../../src/ocr/filter.js';
import type { OcrRegion } from '../../src/ports/ocr.js';

describe('filterOcrByConfidence', () => {
  it('임계값 이상인 region만 반환', () => {
    const regions: OcrRegion[] = [
      { text: '높음', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
      { text: '경계', x: 0, y: 0, width: 10, height: 10, confidence: 50 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['높음', '경계']);
  });

  it('confidence가 없으면 포함 (100으로 간주)', () => {
    const regions: OcrRegion[] = [
      { text: '없음', x: 0, y: 0, width: 10, height: 10 },
      { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['없음']);
  });

  it('빈 배열이면 빈 배열 반환', () => {
    const result = filterOcrByConfidence([], 50);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run filter.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create directory and implementation**

`packages/core/src/ocr/filter.ts` 파일 생성:

```typescript
import type { OcrRegion } from '../ports/ocr.js';

export function filterOcrByConfidence(
  regions: OcrRegion[],
  threshold: number
): string[] {
  return regions
    .filter(r => (r.confidence ?? 100) >= threshold)
    .map(r => r.text);
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run filter.test.ts`
Expected: PASS

**Step 5: Export from index**

`packages/core/src/ocr/index.ts` 파일 생성:

```typescript
export { filterOcrByConfidence } from './filter.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/ocr packages/core/tests/ocr
git commit -m "feat(core): filterOcrByConfidence 유틸 함수 구현"
```

---

### Task 6: api.ts에 convertToMdWithOcr 함수 추가

**Files:**
- Modify: `packages/core/src/api.ts`
- Create: `packages/core/tests/api.test.ts`

**Step 1: Write the failing test**

`packages/core/tests/api.test.ts` 파일 생성:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { convertToMdWithOcr } from '../src/api.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort, OcrResult } from '../src/ports/ocr.js';
import type { Note } from '../src/models/Note.js';

describe('convertToMdWithOcr', () => {
  const mockNote: Note = {
    pages: [
      {
        width: 100,
        height: 100,
        strokes: [],
      },
    ],
  };

  const mockParser: ParserPort = {
    parse: vi.fn().mockResolvedValue(mockNote),
  };

  const mockOcrResult: OcrResult = {
    text: '테스트 텍스트',
    confidence: 80,
    regions: [
      { text: '테스트', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '텍스트', x: 20, y: 0, width: 10, height: 10, confidence: 90 },
    ],
  };

  const mockOcr: OcrPort = {
    recognize: vi.fn().mockResolvedValue(mockOcrResult),
  };

  it('OCR 결과가 ## OCR Text 섹션에 포함됨', async () => {
    const result = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      mockOcr
    );

    expect(result).toContain('## OCR Text');
    expect(result).toContain('테스트');
    expect(result).toContain('텍스트');
  });

  it('confidence 임계값 적용', async () => {
    const ocrWithLowConfidence: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '혼합',
        regions: [
          { text: '높음', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
          { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
        ],
      }),
    };

    const result = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      ocrWithLowConfidence,
      { ocrConfidenceThreshold: 50 }
    );

    expect(result).toContain('높음');
    expect(result).not.toContain('낮음');
  });

  it('기본 confidence 임계값은 50', async () => {
    const ocrWithLowConfidence: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '혼합',
        regions: [
          { text: '경계', x: 0, y: 0, width: 10, height: 10, confidence: 50 },
          { text: '미만', x: 0, y: 0, width: 10, height: 10, confidence: 49 },
        ],
      }),
    };

    const result = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      ocrWithLowConfidence
    );

    expect(result).toContain('경계');
    expect(result).not.toContain('미만');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run api.test.ts`
Expected: FAIL with "convertToMdWithOcr is not exported"

**Step 3: Write implementation**

`packages/core/src/api.ts` 수정:

```typescript
import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import { ExcalidrawGenerator } from './excalidraw/generator.js';
import { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
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

  // 페이지별 OCR 처리
  // TODO: 실제로는 StrokeRenderer로 이미지 생성 후 OCR 호출 필요
  // 현재는 단일 이미지 OCR 결과를 첫 페이지로 처리
  const ocrResult = await ocr.recognize(data);
  const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);

  const ocrResults: OcrTextResult[] = filteredTexts.length > 0
    ? [{ pageIndex: 0, texts: filteredTexts }]
    : [];

  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData, undefined, ocrResults);
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run api.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `cd packages/core && pnpm test -- --run`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/core/src/api.ts packages/core/tests/api.test.ts
git commit -m "feat(core): convertToMdWithOcr 함수 추가"
```

---

### Task 7: 빈 텍스트 필터링 추가

**Files:**
- Modify: `packages/core/src/ocr/filter.ts`
- Modify: `packages/core/tests/ocr/filter.test.ts`

**Step 1: Write the failing test**

`filter.test.ts`에 추가:

```typescript
  it('빈 문자열이나 공백만 있는 텍스트 제외', () => {
    const regions: OcrRegion[] = [
      { text: '유효', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '   ', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '\n\t', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['유효']);
  });
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run filter.test.ts`
Expected: FAIL - 빈 문자열이 포함됨

**Step 3: Write implementation**

`filter.ts` 수정:

```typescript
import type { OcrRegion } from '../ports/ocr.js';

export function filterOcrByConfidence(
  regions: OcrRegion[],
  threshold: number
): string[] {
  return regions
    .filter(r => (r.confidence ?? 100) >= threshold)
    .map(r => r.text.trim())
    .filter(text => text.length > 0);
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run filter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/ocr/filter.ts packages/core/tests/ocr/filter.test.ts
git commit -m "feat(core): 빈 텍스트 필터링 추가"
```

---

### Task 8: 주석으로 elements 추가 방식 남기기

**Files:**
- Modify: `packages/core/src/excalidraw/md-generator.ts`

**Step 1: 주석 추가**

`md-generator.ts`의 `formatOcrSection` 메서드 위에 주석 추가:

```typescript
  /**
   * OCR 결과를 ## OCR Text 섹션으로 포맷팅
   *
   * 현재 구현: back-of-note 영역에 텍스트만 추가 (캔버스에 안 보임, Obsidian 검색 가능)
   *
   * TODO: 향후 옵션으로 text 요소를 elements에 추가하는 방식 지원 고려
   * - elements 배열에 type: 'text' 요소 추가
   * - opacity: 0 또는 캔버스 밖 좌표로 숨김 처리
   * - ## Text Elements 섹션에도 표시되어 Excalidraw 내부 검색 가능
   *
   * @example
   * // elements에 추가하는 방식 (미구현)
   * const textElement = {
   *   type: 'text',
   *   id: nanoid(),
   *   text: ocrText,
   *   x: -99999,  // 캔버스 밖
   *   y: -99999,
   *   opacity: 0,
   *   // ... 기타 필수 속성
   * };
   */
  private formatOcrSection(ocrResults?: OcrTextResult[]): string {
```

**Step 2: Run tests to ensure no regression**

Run: `cd packages/core && pnpm test -- --run`
Expected: All PASS

**Step 3: Commit**

```bash
git add packages/core/src/excalidraw/md-generator.ts
git commit -m "docs(core): elements 추가 방식 TODO 주석 추가"
```

---

### Task 9: 전체 통합 테스트

**Files:**
- Modify: `packages/core/tests/api.test.ts`

**Step 1: Write integration test**

`api.test.ts`에 추가:

```typescript
describe('convertToMdWithOcr integration', () => {
  it('생성된 마크다운이 올바른 구조를 가짐', async () => {
    const mockNote: Note = {
      pages: [{ width: 100, height: 100, strokes: [] }],
    };

    const mockParser: ParserPort = {
      parse: vi.fn().mockResolvedValue(mockNote),
    };

    const mockOcr: OcrPort = {
      recognize: vi.fn().mockResolvedValue({
        text: '테스트',
        regions: [
          { text: '안녕하세요', x: 0, y: 0, width: 10, height: 10, confidence: 90 },
        ],
      }),
    };

    const md = await convertToMdWithOcr(
      new ArrayBuffer(0),
      mockParser,
      mockOcr
    );

    // 구조 검증
    expect(md).toMatch(/^---\nexcalidraw-plugin: parsed/);
    expect(md).toContain('## OCR Text');
    expect(md).toContain('# Excalidraw Data');
    expect(md).toContain('## Text Elements');
    expect(md).toContain('## Drawing');

    // 순서 검증: OCR Text < Excalidraw Data < Text Elements < Drawing
    const ocrIndex = md.indexOf('## OCR Text');
    const dataIndex = md.indexOf('# Excalidraw Data');
    const textIndex = md.indexOf('## Text Elements');
    const drawingIndex = md.indexOf('## Drawing');

    expect(ocrIndex).toBeLessThan(dataIndex);
    expect(dataIndex).toBeLessThan(textIndex);
    expect(textIndex).toBeLessThan(drawingIndex);

    // OCR 텍스트 포함 확인
    expect(md).toContain('안녕하세요');
  });
});
```

**Step 2: Run test**

Run: `cd packages/core && pnpm test -- --run api.test.ts`
Expected: PASS

**Step 3: Run all tests**

Run: `cd packages/core && pnpm test -- --run`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/core/tests/api.test.ts
git commit -m "test(core): convertToMdWithOcr 통합 테스트 추가"
```

---

### Task 10: Export 정리 및 최종 검증

**Files:**
- Modify: `packages/core/src/index.ts` (있다면)

**Step 1: 현재 export 확인**

`packages/core/src/index.ts` 또는 진입점 파일에서 새 함수/타입이 export되는지 확인

**Step 2: 필요시 export 추가**

```typescript
export { convert, convertToMd, convertToMdWithOcr } from './api.js';
export type { ConvertOptions } from './api.js';
export { filterOcrByConfidence } from './ocr/filter.js';
export type { OcrTextResult } from './excalidraw/md-generator.js';
```

**Step 3: Type check**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS

**Step 4: Run all tests**

Run: `cd packages/core && pnpm test -- --run`
Expected: All PASS

**Step 5: Final commit**

```bash
git add packages/core/src
git commit -m "feat(core): OCR Text 섹션 기능 완료"
```

---

## Summary

| Task | 설명 | 파일 |
|------|------|------|
| 1 | OcrTextResult 타입 정의 | md-generator.ts, index.ts |
| 2 | formatOcrSection 빈 결과 처리 | md-generator.ts |
| 3 | formatOcrSection 페이지별 포맷팅 | md-generator.ts |
| 4 | generate()에 ocrResults 파라미터 추가 | md-generator.ts |
| 5 | filterOcrByConfidence 유틸 함수 | ocr/filter.ts |
| 6 | convertToMdWithOcr 함수 추가 | api.ts |
| 7 | 빈 텍스트 필터링 | ocr/filter.ts |
| 8 | elements 추가 방식 TODO 주석 | md-generator.ts |
| 9 | 통합 테스트 | api.test.ts |
| 10 | Export 정리 및 최종 검증 | index.ts |
