# FileGeneratorPort 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 다중 출력 포맷 지원을 위한 FileGeneratorPort 인터페이스 도입 및 ExcalidrawFileGenerator, MarkdownFileGenerator 구현

**Architecture:**
- FileGeneratorPort 인터페이스를 core에 정의하고, generator-excalidraw, generator-markdown 패키지에서 구현
- 모든 Generator는 외부 에셋 파일 방식 사용 (base64 임베드 제거)
- 에셋은 `assets/{노트이름}/` 디렉터리에 저장

**Tech Stack:** TypeScript, Vitest, pnpm workspace

---

## Task 1: FileGeneratorPort 인터페이스 정의

**Files:**
- Create: `packages/core/src/ports/file-generator.ts`
- Modify: `packages/core/src/ports/index.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: FileGeneratorPort 인터페이스 작성**

```typescript
// packages/core/src/ports/file-generator.ts
import type { Note } from '../models/index.js';

export interface OcrTextResult {
  pageIndex: number;
  texts: string[];
}

export interface GeneratorOutput {
  readonly content: string;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly extension: string;
}

export interface FileGeneratorPort {
  readonly id: string;
  readonly displayName: string;
  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput;
}
```

**Step 2: ports/index.ts에 export 추가**

```typescript
// packages/core/src/ports/index.ts에 추가
export type {
  FileGeneratorPort,
  GeneratorOutput,
  OcrTextResult,
} from './file-generator.js';
```

**Step 3: core index.ts에 export 추가**

```typescript
// packages/core/src/index.ts에 추가
export type {
  FileGeneratorPort,
  GeneratorOutput,
  OcrTextResult,
} from './ports/file-generator.js';
```

**Step 4: 타입체크**

Run: `pnpm --filter @petrify/core typecheck`
Expected: 성공

**Step 5: 커밋**

```bash
git add packages/core/src/ports/file-generator.ts packages/core/src/ports/index.ts packages/core/src/index.ts
git commit -m "feat(core): FileGeneratorPort 인터페이스 정의"
```

---

## Task 2: @petrify/generator-excalidraw 패키지 생성

**Files:**
- Create: `packages/generator/excalidraw/package.json`
- Create: `packages/generator/excalidraw/src/index.ts`
- Create: `packages/generator/excalidraw/tsconfig.json`
- Modify: `tsconfig.json` (루트)

**Step 1: 패키지 디렉터리 생성**

Run: `mkdir -p packages/generator/excalidraw/src`

**Step 2: package.json 작성**

```json
// packages/generator/excalidraw/package.json
{
  "name": "@petrify/generator-excalidraw",
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
    "lz-string": "^1.5.0"
  },
  "devDependencies": {
    "@types/lz-string": "^1.5.0"
  }
}
```

**Step 3: tsconfig.json 작성**

```json
// packages/generator/excalidraw/tsconfig.json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 4: 루트 tsconfig.json에 paths 추가**

```json
// tsconfig.json paths에 추가
"@petrify/generator-excalidraw": ["packages/generator/excalidraw/src/index.ts"]
```

**Step 5: 빈 index.ts 생성**

```typescript
// packages/generator/excalidraw/src/index.ts
export {};
```

**Step 6: pnpm install**

Run: `pnpm install`
Expected: 성공

**Step 7: 커밋**

```bash
git add packages/generator/excalidraw tsconfig.json pnpm-lock.yaml
git commit -m "chore: @petrify/generator-excalidraw 패키지 생성"
```

---

## Task 3: core/excalidraw 모듈을 generator-excalidraw로 이동

**Files:**
- Move: `packages/core/src/excalidraw/generator.ts` → `packages/generator/excalidraw/src/excalidraw-generator.ts`
- Move: `packages/core/src/excalidraw/md-generator.ts` → `packages/generator/excalidraw/src/md-generator.ts`
- Move: `packages/core/src/excalidraw/base64.ts` → `packages/generator/excalidraw/src/base64.ts`
- Move: `packages/core/tests/excalidraw/excalidraw.test.ts` → `packages/generator/excalidraw/tests/excalidraw-generator.test.ts`
- Move: `packages/core/tests/excalidraw/excalidraw-md.test.ts` → `packages/generator/excalidraw/tests/md-generator.test.ts`
- Delete: `packages/core/src/excalidraw/` 디렉터리

**Step 1: 파일 복사 및 import 경로 수정**

base64.ts는 그대로 복사:
```typescript
// packages/generator/excalidraw/src/base64.ts
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

excalidraw-generator.ts (import 경로만 수정):
```typescript
// packages/generator/excalidraw/src/excalidraw-generator.ts
import type { Note, Page } from '@petrify/core';
import { uint8ArrayToBase64 } from './base64.js';
// ... 나머지 코드 동일
```

md-generator.ts (import 경로만 수정):
```typescript
// packages/generator/excalidraw/src/md-generator.ts
import LZString from 'lz-string';
import type { ExcalidrawData } from './excalidraw-generator.js';
// ... 나머지 코드 동일
```

**Step 2: 테스트 파일 복사 및 수정**

```bash
mkdir -p packages/generator/excalidraw/tests
```

테스트 파일 import 경로 수정:
```typescript
// packages/generator/excalidraw/tests/excalidraw-generator.test.ts
import { describe, it, expect } from 'vitest';
import { ExcalidrawGenerator } from '../src/excalidraw-generator.js';
import type { ExcalidrawFileEntry } from '../src/excalidraw-generator.js';
import type { Note, Page } from '@petrify/core';
// ... 나머지 동일
```

**Step 3: generator-excalidraw index.ts에서 export**

```typescript
// packages/generator/excalidraw/src/index.ts
export { ExcalidrawGenerator } from './excalidraw-generator.js';
export type { ExcalidrawData, ExcalidrawElement, ExcalidrawFileEntry } from './excalidraw-generator.js';
export { ExcalidrawMdGenerator } from './md-generator.js';
export type { OcrTextResult } from './md-generator.js';
export { uint8ArrayToBase64 } from './base64.js';
```

**Step 4: core에서 excalidraw 관련 export 제거**

packages/core/src/index.ts에서 삭제:
```typescript
// 삭제할 라인들
- export { ExcalidrawGenerator } from './excalidraw/generator.js';
- export { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
- export { uint8ArrayToBase64 } from './excalidraw/base64.js';
- export type { ExcalidrawData, ExcalidrawElement, ExcalidrawFileEntry } from './excalidraw/generator.js';
- export type { OcrTextResult } from './excalidraw/md-generator.js';
```

**Step 5: core/excalidraw 디렉터리 삭제**

Run: `rm -rf packages/core/src/excalidraw packages/core/tests/excalidraw`

**Step 6: 테스트 실행**

Run: `pnpm --filter @petrify/generator-excalidraw test`
Expected: 모든 테스트 통과

**Step 7: 커밋**

```bash
git add -A
git commit -m "refactor: excalidraw 모듈을 @petrify/generator-excalidraw로 이동"
```

---

## Task 4: ExcalidrawFileGenerator 구현

**Files:**
- Create: `packages/generator/excalidraw/src/excalidraw-file-generator.ts`
- Create: `packages/generator/excalidraw/tests/excalidraw-file-generator.test.ts`
- Modify: `packages/generator/excalidraw/src/index.ts`

**Step 1: 테스트 먼저 작성**

```typescript
// packages/generator/excalidraw/tests/excalidraw-file-generator.test.ts
import { describe, it, expect } from 'vitest';
import { ExcalidrawFileGenerator } from '../src/excalidraw-file-generator.js';
import type { Note, Page } from '@petrify/core';

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    order: 0,
    width: 1440,
    height: 1920,
    ...overrides,
  };
}

function createNote(pages: Page[]): Note {
  return {
    title: 'Test',
    pages,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

describe('ExcalidrawFileGenerator', () => {
  it('id와 displayName이 정의됨', () => {
    const generator = new ExcalidrawFileGenerator();
    expect(generator.id).toBe('excalidraw');
    expect(generator.displayName).toBe('Excalidraw');
  });

  it('extension이 .excalidraw.md', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const output = generator.generate(note, 'test-note');
    expect(output.extension).toBe('.excalidraw.md');
  });

  it('assets에 페이지 이미지가 포함됨', () => {
    const generator = new ExcalidrawFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = generator.generate(note, 'test-note');

    expect(output.assets.size).toBe(1);
    expect(output.assets.get('p1.png')).toEqual(imageData);
  });

  it('content에 embedded files 참조가 포함됨', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'test-note');

    expect(output.content).toContain('p1: [[assets/test-note/p1.png]]');
  });

  it('다중 페이지 시 모든 assets 포함', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([
      createPage({ id: 'p1', order: 0 }),
      createPage({ id: 'p2', order: 1 }),
    ]);
    const output = generator.generate(note, 'my-note');

    expect(output.assets.size).toBe(2);
    expect(output.assets.has('p1.png')).toBe(true);
    expect(output.assets.has('p2.png')).toBe(true);
    expect(output.content).toContain('p1: [[assets/my-note/p1.png]]');
    expect(output.content).toContain('p2: [[assets/my-note/p2.png]]');
  });

  it('OCR 결과가 content에 포함됨', () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const ocrResults = [{ pageIndex: 0, texts: ['안녕하세요', '테스트'] }];
    const output = generator.generate(note, 'test', ocrResults);

    expect(output.content).toContain('## OCR Text');
    expect(output.content).toContain('안녕하세요');
    expect(output.content).toContain('테스트');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/generator-excalidraw test`
Expected: FAIL - excalidraw-file-generator.ts not found

**Step 3: ExcalidrawFileGenerator 구현**

```typescript
// packages/generator/excalidraw/src/excalidraw-file-generator.ts
import type { Note } from '@petrify/core';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from '@petrify/core';
import { ExcalidrawGenerator } from './excalidraw-generator.js';
import { ExcalidrawMdGenerator } from './md-generator.js';

export class ExcalidrawFileGenerator implements FileGeneratorPort {
  readonly id = 'excalidraw';
  readonly displayName = 'Excalidraw';

  private readonly excalidrawGenerator = new ExcalidrawGenerator();
  private readonly mdGenerator = new ExcalidrawMdGenerator();

  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput {
    const { assets, embeddedFiles } = this.extractAssets(note, outputName);
    const excalidrawData = this.excalidrawGenerator.generateWithoutFiles(note);
    const content = this.mdGenerator.generate(excalidrawData, embeddedFiles, ocrResults);

    return {
      content,
      assets,
      extension: '.excalidraw.md',
    };
  }

  private extractAssets(
    note: Note,
    outputName: string,
  ): { assets: Map<string, Uint8Array>; embeddedFiles: Record<string, string> } {
    const assets = new Map<string, Uint8Array>();
    const embeddedFiles: Record<string, string> = {};
    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    for (const page of sortedPages) {
      const filename = `${page.id}.png`;
      assets.set(filename, page.imageData);
      embeddedFiles[page.id] = `assets/${outputName}/${filename}`;
    }

    return { assets, embeddedFiles };
  }
}
```

**Step 4: ExcalidrawGenerator에 generateWithoutFiles 메서드 추가**

ExcalidrawGenerator를 수정하여 files 없이 생성하는 메서드 추가:

```typescript
// packages/generator/excalidraw/src/excalidraw-generator.ts에 메서드 추가

generateWithoutFiles(note: Note): ExcalidrawData {
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
```

**Step 5: index.ts에 export 추가**

```typescript
// packages/generator/excalidraw/src/index.ts에 추가
export { ExcalidrawFileGenerator } from './excalidraw-file-generator.js';
```

**Step 6: 테스트 실행**

Run: `pnpm --filter @petrify/generator-excalidraw test`
Expected: 모든 테스트 통과

**Step 7: 커밋**

```bash
git add packages/generator/excalidraw
git commit -m "feat(generator-excalidraw): ExcalidrawFileGenerator 구현"
```

---

## Task 5: @petrify/generator-markdown 패키지 생성

**Files:**
- Create: `packages/generator/markdown/package.json`
- Create: `packages/generator/markdown/src/index.ts`
- Create: `packages/generator/markdown/tsconfig.json`
- Modify: `tsconfig.json` (루트)

**Step 1: 패키지 디렉터리 생성**

Run: `mkdir -p packages/generator/markdown/src`

**Step 2: package.json 작성**

```json
// packages/generator/markdown/package.json
{
  "name": "@petrify/generator-markdown",
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
    "@petrify/core": "workspace:*"
  }
}
```

**Step 3: tsconfig.json 작성**

```json
// packages/generator/markdown/tsconfig.json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 4: 루트 tsconfig.json에 paths 추가**

```json
// tsconfig.json paths에 추가
"@petrify/generator-markdown": ["packages/generator/markdown/src/index.ts"]
```

**Step 5: 빈 index.ts 생성**

```typescript
// packages/generator/markdown/src/index.ts
export {};
```

**Step 6: pnpm install**

Run: `pnpm install`
Expected: 성공

**Step 7: 커밋**

```bash
git add packages/generator/markdown tsconfig.json pnpm-lock.yaml
git commit -m "chore: @petrify/generator-markdown 패키지 생성"
```

---

## Task 6: MarkdownFileGenerator 구현

**Files:**
- Create: `packages/generator/markdown/src/markdown-file-generator.ts`
- Create: `packages/generator/markdown/tests/markdown-file-generator.test.ts`
- Modify: `packages/generator/markdown/src/index.ts`

**Step 1: 테스트 먼저 작성**

```typescript
// packages/generator/markdown/tests/markdown-file-generator.test.ts
import { describe, it, expect } from 'vitest';
import { MarkdownFileGenerator } from '../src/markdown-file-generator.js';
import type { Note, Page } from '@petrify/core';

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    order: 0,
    width: 1440,
    height: 1920,
    ...overrides,
  };
}

function createNote(pages: Page[]): Note {
  return {
    title: 'Test',
    pages,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

describe('MarkdownFileGenerator', () => {
  it('id와 displayName이 정의됨', () => {
    const generator = new MarkdownFileGenerator();
    expect(generator.id).toBe('markdown');
    expect(generator.displayName).toBe('Markdown');
  });

  it('extension이 .md', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage()]);
    const output = generator.generate(note, 'test-note');
    expect(output.extension).toBe('.md');
  });

  it('assets에 페이지 이미지가 포함됨', () => {
    const generator = new MarkdownFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = generator.generate(note, 'test-note');

    expect(output.assets.size).toBe(1);
    expect(output.assets.get('p1.png')).toEqual(imageData);
  });

  it('OCR 텍스트가 상단에, 이미지가 하단에 배치됨', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const ocrResults = [{ pageIndex: 0, texts: ['안녕하세요'] }];
    const output = generator.generate(note, 'test-note', ocrResults);

    const ocrIndex = output.content.indexOf('안녕하세요');
    const separatorIndex = output.content.indexOf('---');
    const imageIndex = output.content.indexOf('![[');

    expect(ocrIndex).toBeLessThan(separatorIndex);
    expect(separatorIndex).toBeLessThan(imageIndex);
  });

  it('이미지 참조가 assets 경로를 사용', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'my-note');

    expect(output.content).toContain('![[assets/my-note/p1.png]]');
  });

  it('다중 페이지 시 order 순서대로 배치', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([
      createPage({ id: 'p2', order: 1 }),
      createPage({ id: 'p1', order: 0 }),
    ]);
    const output = generator.generate(note, 'test');

    const p1Index = output.content.indexOf('p1.png');
    const p2Index = output.content.indexOf('p2.png');
    expect(p1Index).toBeLessThan(p2Index);
  });

  it('OCR 결과가 없으면 이미지만 출력', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([createPage({ id: 'p1' })]);
    const output = generator.generate(note, 'test');

    expect(output.content).toContain('---');
    expect(output.content).toContain('![[assets/test/p1.png]]');
  });

  it('다중 페이지 OCR이 페이지별로 출력됨', () => {
    const generator = new MarkdownFileGenerator();
    const note = createNote([
      createPage({ id: 'p1', order: 0 }),
      createPage({ id: 'p2', order: 1 }),
    ]);
    const ocrResults = [
      { pageIndex: 0, texts: ['첫번째 페이지'] },
      { pageIndex: 1, texts: ['두번째 페이지'] },
    ];
    const output = generator.generate(note, 'test', ocrResults);

    expect(output.content).toContain('첫번째 페이지');
    expect(output.content).toContain('두번째 페이지');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/generator-markdown test`
Expected: FAIL - markdown-file-generator.ts not found

**Step 3: MarkdownFileGenerator 구현**

```typescript
// packages/generator/markdown/src/markdown-file-generator.ts
import type { Note } from '@petrify/core';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from '@petrify/core';

export class MarkdownFileGenerator implements FileGeneratorPort {
  readonly id = 'markdown';
  readonly displayName = 'Markdown';

  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput {
    const assets = new Map<string, Uint8Array>();
    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    let ocrSection = '';
    let imageSection = '';

    for (const page of sortedPages) {
      const filename = `${page.id}.png`;
      assets.set(filename, page.imageData);

      const pageOcr = ocrResults?.find((r) => r.pageIndex === page.order);
      if (pageOcr && pageOcr.texts.length > 0) {
        ocrSection += pageOcr.texts.join('\n') + '\n\n';
      }

      imageSection += `![[assets/${outputName}/${filename}]]\n`;
    }

    const content = ocrSection + '---\n\n' + imageSection;

    return {
      content: content.trim() + '\n',
      assets,
      extension: '.md',
    };
  }
}
```

**Step 4: index.ts에 export 추가**

```typescript
// packages/generator/markdown/src/index.ts
export { MarkdownFileGenerator } from './markdown-file-generator.js';
```

**Step 5: 테스트 실행**

Run: `pnpm --filter @petrify/generator-markdown test`
Expected: 모든 테스트 통과

**Step 6: 커밋**

```bash
git add packages/generator/markdown
git commit -m "feat(generator-markdown): MarkdownFileGenerator 구현"
```

---

## Task 7: core API 정리 및 OcrTextResult 이동

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/api.ts`
- Delete: `packages/core/tests/api.test.ts`
- Modify: `packages/generator/excalidraw/src/md-generator.ts`

**Step 1: core에서 OcrTextResult export 삭제 (ports/file-generator.ts로 이동됨)**

md-generator.ts에서 OcrTextResult 정의 제거하고 import로 변경:

```typescript
// packages/generator/excalidraw/src/md-generator.ts
import LZString from 'lz-string';
import type { OcrTextResult } from '@petrify/core';
import type { ExcalidrawData } from './excalidraw-generator.js';

// OcrTextResult interface 삭제 (이미 core에 있음)

export class ExcalidrawMdGenerator {
  // ... 기존 코드
}
```

**Step 2: core api.ts에서 기존 함수들 제거**

```typescript
// packages/core/src/api.ts
export const DEFAULT_CONFIDENCE_THRESHOLD = 50;
```

**Step 3: core index.ts 정리**

기존 api export 제거:
```typescript
// 제거
- export { convert, convertToMd, convertToMdWithOcr, DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
- export type { ConvertOptions } from './api.js';

// 유지
+ export { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
```

**Step 4: api.test.ts 삭제**

Run: `rm packages/core/tests/api.test.ts`

**Step 5: 타입체크 및 테스트**

Run: `pnpm typecheck && pnpm test`
Expected: 모든 테스트 통과

**Step 6: 커밋**

```bash
git add -A
git commit -m "refactor(core): 기존 convert API 제거, FileGeneratorPort로 대체"
```

---

## Task 8: ConversionPipeline FileGeneratorPort 연동

**Files:**
- Modify: `packages/core/src/conversion-pipeline.ts`
- Modify: `packages/core/tests/conversion-pipeline.test.ts`

**Step 1: ConversionPipeline 수정**

```typescript
// packages/core/src/conversion-pipeline.ts
import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import type { ConversionStatePort } from './ports/conversion-state.js';
import type { FileChangeEvent } from './ports/watcher.js';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from './ports/file-generator.js';
import { filterOcrByConfidence } from './ocr/filter.js';
import { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';

export interface ConversionPipelineOptions {
  readonly confidenceThreshold: number;
}

export class ConversionPipeline {
  private readonly parserMap: Map<string, ParserPort>;

  constructor(
    parsers: Map<string, ParserPort>,
    private readonly generator: FileGeneratorPort,
    private readonly ocr: OcrPort | null,
    private readonly conversionState: ConversionStatePort,
    private readonly options: ConversionPipelineOptions,
  ) {
    this.parserMap = parsers;
  }

  getParsersForExtension(ext: string): ParserPort[] {
    const parser = this.parserMap.get(ext.toLowerCase());
    return parser ? [parser] : [];
  }

  async convertDroppedFile(
    data: ArrayBuffer,
    parser: ParserPort,
    outputName: string,
  ): Promise<GeneratorOutput> {
    return this.convertData(data, parser, outputName);
  }

  async handleFileChange(event: FileChangeEvent): Promise<GeneratorOutput | null> {
    const parser = this.parserMap.get(event.extension.toLowerCase());
    if (!parser) {
      console.log(`[Petrify:Convert] Skipped (unsupported): ${event.name}`);
      return null;
    }

    const lastMtime = await this.conversionState.getLastConvertedMtime(event.id);
    if (lastMtime !== undefined && event.mtime <= lastMtime) {
      console.log(`[Petrify:Convert] Skipped (up-to-date): ${event.name}`);
      return null;
    }

    const data = await event.readData();
    const baseName = event.name.replace(/\.[^/.]+$/, '');
    return this.convertData(data, parser, baseName);
  }

  private async convertData(
    data: ArrayBuffer,
    parser: ParserPort,
    outputName: string,
  ): Promise<GeneratorOutput> {
    const note = await parser.parse(data);
    const threshold = this.options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

    let ocrResults: OcrTextResult[] | undefined;

    if (this.ocr) {
      ocrResults = [];
      for (const page of note.pages) {
        if (page.imageData.length === 0) continue;

        const imageBuffer = new Uint8Array(page.imageData).buffer;
        const ocrResult = await this.ocr.recognize(imageBuffer);
        const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);

        if (filteredTexts.length > 0) {
          ocrResults.push({ pageIndex: page.order, texts: filteredTexts });
        }
      }
    }

    return this.generator.generate(note, outputName, ocrResults);
  }
}
```

**Step 2: conversion-pipeline.test.ts 수정**

테스트를 FileGeneratorPort 사용 방식으로 업데이트:

```typescript
// packages/core/tests/conversion-pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversionPipeline } from '../src/conversion-pipeline.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { OcrPort } from '../src/ports/ocr.js';
import type { ConversionStatePort } from '../src/ports/conversion-state.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';
import type { FileGeneratorPort, GeneratorOutput } from '../src/ports/file-generator.js';
import type { Note } from '../src/models/note.js';

const mockNote: Note = {
  title: 'Test',
  pages: [{
    id: 'p1',
    imageData: new Uint8Array([1, 2, 3]),
    order: 0,
    width: 100,
    height: 100,
  }],
  createdAt: new Date(),
  modifiedAt: new Date(),
};

const mockOutput: GeneratorOutput = {
  content: 'generated content',
  assets: new Map([['p1.png', new Uint8Array([1, 2, 3])]]),
  extension: '.excalidraw.md',
};

describe('ConversionPipeline', () => {
  let mockParser: ParserPort;
  let mockGenerator: FileGeneratorPort;
  let mockOcr: OcrPort;
  let mockConversionState: ConversionStatePort;

  beforeEach(() => {
    mockParser = {
      extensions: ['.note'],
      parse: vi.fn().mockResolvedValue(mockNote),
    };

    mockGenerator = {
      id: 'test',
      displayName: 'Test',
      generate: vi.fn().mockReturnValue(mockOutput),
    };

    mockOcr = {
      recognize: vi.fn().mockResolvedValue({
        text: '',
        regions: [],
      }),
    };

    mockConversionState = {
      getLastConvertedMtime: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('handleFileChange가 GeneratorOutput을 반환', async () => {
    const parsers = new Map([['.note', mockParser]]);
    const pipeline = new ConversionPipeline(
      parsers,
      mockGenerator,
      mockOcr,
      mockConversionState,
      { confidenceThreshold: 50 },
    );

    const event: FileChangeEvent = {
      id: '/path/to/file.note',
      name: 'file.note',
      extension: '.note',
      mtime: Date.now(),
      readData: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    };

    const result = await pipeline.handleFileChange(event);

    expect(result).toEqual(mockOutput);
    expect(mockGenerator.generate).toHaveBeenCalledWith(
      mockNote,
      'file',
      expect.any(Array),
    );
  });

  it('convertDroppedFile이 outputName을 전달', async () => {
    const parsers = new Map([['.note', mockParser]]);
    const pipeline = new ConversionPipeline(
      parsers,
      mockGenerator,
      null,
      mockConversionState,
      { confidenceThreshold: 50 },
    );

    const result = await pipeline.convertDroppedFile(
      new ArrayBuffer(0),
      mockParser,
      'my-note',
    );

    expect(result).toEqual(mockOutput);
    expect(mockGenerator.generate).toHaveBeenCalledWith(
      mockNote,
      'my-note',
      undefined,
    );
  });

  it('지원하지 않는 확장자는 null 반환', async () => {
    const parsers = new Map([['.note', mockParser]]);
    const pipeline = new ConversionPipeline(
      parsers,
      mockGenerator,
      null,
      mockConversionState,
      { confidenceThreshold: 50 },
    );

    const event: FileChangeEvent = {
      id: '/path/to/file.txt',
      name: 'file.txt',
      extension: '.txt',
      mtime: Date.now(),
      readData: vi.fn(),
    };

    const result = await pipeline.handleFileChange(event);
    expect(result).toBeNull();
  });

  it('mtime이 이전과 같으면 null 반환', async () => {
    const parsers = new Map([['.note', mockParser]]);
    (mockConversionState.getLastConvertedMtime as ReturnType<typeof vi.fn>)
      .mockResolvedValue(1000);

    const pipeline = new ConversionPipeline(
      parsers,
      mockGenerator,
      null,
      mockConversionState,
      { confidenceThreshold: 50 },
    );

    const event: FileChangeEvent = {
      id: '/path/to/file.note',
      name: 'file.note',
      extension: '.note',
      mtime: 1000,
      readData: vi.fn(),
    };

    const result = await pipeline.handleFileChange(event);
    expect(result).toBeNull();
  });
});
```

**Step 3: 테스트 실행**

Run: `pnpm --filter @petrify/core test`
Expected: 모든 테스트 통과

**Step 4: 커밋**

```bash
git add packages/core
git commit -m "refactor(core): ConversionPipeline FileGeneratorPort 연동"
```

---

## Task 9: Obsidian 플러그인 업데이트 - 설정

**Files:**
- Modify: `packages/obsidian-plugin/src/settings.ts`
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`
- Modify: `packages/obsidian-plugin/tests/settings.test.ts`

**Step 1: settings.ts에 outputFormat 추가**

```typescript
// packages/obsidian-plugin/src/settings.ts
import { DEFAULT_CONFIDENCE_THRESHOLD } from '@petrify/core';

export type OutputFormat = 'excalidraw' | 'markdown';

export interface WatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
}

export interface OcrSettings {
  confidenceThreshold: number;
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
  deleteConvertedOnSourceDelete: boolean;
  outputFormat: OutputFormat;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  watchMappings: [],
  ocr: {
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  },
  deleteConvertedOnSourceDelete: false,
  outputFormat: 'excalidraw',
};
```

**Step 2: settings-tab.ts에 드롭다운 추가**

```typescript
// packages/obsidian-plugin/src/settings-tab.ts에 추가
// createGeneralSettings 또는 적절한 위치에:

new Setting(containerEl)
  .setName('출력 포맷')
  .setDesc('변환 결과 파일 형식')
  .addDropdown((dropdown) =>
    dropdown
      .addOption('excalidraw', 'Excalidraw (.excalidraw.md)')
      .addOption('markdown', 'Markdown (.md)')
      .setValue(settings.outputFormat)
      .onChange(async (value) => {
        settings.outputFormat = value as OutputFormat;
        await callbacks.saveDataOnly(settings);
      })
  );
```

**Step 3: settings.test.ts 업데이트**

```typescript
// packages/obsidian-plugin/tests/settings.test.ts에 추가
it('기본 outputFormat은 excalidraw', () => {
  expect(DEFAULT_SETTINGS.outputFormat).toBe('excalidraw');
});
```

**Step 4: 테스트 실행**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: 모든 테스트 통과

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/settings.ts packages/obsidian-plugin/src/settings-tab.ts packages/obsidian-plugin/tests/settings.test.ts
git commit -m "feat(obsidian-plugin): 출력 포맷 설정 추가"
```

---

## Task 10: Obsidian 플러그인 업데이트 - Generator 연동

**Files:**
- Modify: `packages/obsidian-plugin/package.json`
- Modify: `packages/obsidian-plugin/src/main.ts`
- Modify: `packages/obsidian-plugin/src/drop-handler.ts`
- Create: `packages/obsidian-plugin/src/utils/save-output.ts`

**Step 1: package.json에 generator 의존성 추가**

```json
// packages/obsidian-plugin/package.json dependencies에 추가
"@petrify/generator-excalidraw": "workspace:*",
"@petrify/generator-markdown": "workspace:*"
```

Run: `pnpm install`

**Step 2: save-output.ts 유틸리티 생성**

```typescript
// packages/obsidian-plugin/src/utils/save-output.ts
import * as path from 'path';
import type { App } from 'obsidian';
import type { GeneratorOutput } from '@petrify/core';

export async function saveGeneratorOutput(
  app: App,
  basePath: string,
  output: GeneratorOutput,
  frontmatter: string,
): Promise<string> {
  const mainPath = basePath + output.extension;
  const fullContent = frontmatter + output.content;

  const existingFile = app.vault.getAbstractFileByPath(mainPath);
  if (existingFile) {
    await app.vault.modify(existingFile as import('obsidian').TFile, fullContent);
  } else {
    const dir = path.dirname(mainPath);
    if (dir && dir !== '.') {
      await ensureDirectory(app, dir);
    }
    await app.vault.create(mainPath, fullContent);
  }

  if (output.assets.size > 0) {
    const dir = path.dirname(basePath);
    const name = path.basename(basePath);
    const assetsDir = dir ? `${dir}/assets/${name}` : `assets/${name}`;

    await ensureDirectory(app, assetsDir);

    for (const [filename, data] of output.assets) {
      const assetPath = `${assetsDir}/${filename}`;
      const existingAsset = app.vault.getAbstractFileByPath(assetPath);
      if (existingAsset) {
        await app.vault.modifyBinary(existingAsset as import('obsidian').TFile, data);
      } else {
        await app.vault.createBinary(assetPath, data);
      }
    }
  }

  return mainPath;
}

async function ensureDirectory(app: App, dirPath: string): Promise<void> {
  const exists = await app.vault.adapter.exists(dirPath);
  if (!exists) {
    await app.vault.createFolder(dirPath);
  }
}
```

**Step 3: main.ts 수정**

```typescript
// packages/obsidian-plugin/src/main.ts 수정

// import 추가
import type { FileGeneratorPort, GeneratorOutput } from '@petrify/core';
import { ExcalidrawFileGenerator } from '@petrify/generator-excalidraw';
import { MarkdownFileGenerator } from '@petrify/generator-markdown';
import { saveGeneratorOutput } from './utils/save-output.js';

// 클래스 내부
private generator!: FileGeneratorPort;

// initializePipeline 수정
private initializePipeline(): void {
  // ... 기존 코드

  this.generator = this.createGenerator();

  this.pipeline = new ConversionPipeline(
    extensionMap,
    this.generator,
    this.ocr,
    conversionState,
    { confidenceThreshold: this.settings.ocr.confidenceThreshold },
  );
}

private createGenerator(): FileGeneratorPort {
  switch (this.settings.outputFormat) {
    case 'markdown':
      return new MarkdownFileGenerator();
    case 'excalidraw':
    default:
      return new ExcalidrawFileGenerator();
  }
}

// processFile 수정
private async processFile(event: FileChangeEvent, outputDir: string): Promise<boolean> {
  const result = await this.pipeline.handleFileChange(event);
  if (!result) return false;

  const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
  const baseName = path.basename(event.name, path.extname(event.name));
  const basePath = path.join(outputDir, baseName);

  await saveGeneratorOutput(this.app, basePath, result, frontmatter);
  this.convertLog.info(`Converted: ${event.name}`);
  return true;
}
```

**Step 4: drop-handler.ts 수정**

```typescript
// packages/obsidian-plugin/src/drop-handler.ts 수정

// import 추가
import type { GeneratorOutput } from '@petrify/core';
import { saveGeneratorOutput } from './utils/save-output.js';

// handleDrop 수정
const result = await this.pipeline.convertDroppedFile(data, parser, baseName);
const frontmatter = createFrontmatter({ source: null, mtime: null, keep: true });
const basePath = dropFolder ? `${dropFolder}/${baseName}` : baseName;

await saveGeneratorOutput(this.app, basePath, result, frontmatter);
```

**Step 5: 타입체크**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: 성공

**Step 6: 커밋**

```bash
git add packages/obsidian-plugin
git commit -m "feat(obsidian-plugin): FileGeneratorPort 연동 및 에셋 저장 로직"
```

---

## Task 11: syncAll 및 삭제 로직 업데이트

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: syncAll 수정**

syncAll에서 `.excalidraw.md` 하드코딩을 제거하고 generator.extension 사용:

```typescript
// syncAll 내부 수정

// 기존:
// if (!outputFile.endsWith('.excalidraw.md')) continue;

// 변경:
const expectedExtension = this.generator.extension || '.excalidraw.md';
// ... 확장자 체크 로직 수정
```

**Step 2: getOutputPath 수정**

```typescript
private getOutputPath(name: string, outputDir: string): string {
  const fileName = path.basename(name, path.extname(name));
  return path.join(outputDir, fileName);
}
```

주의: getOutputPath는 이제 확장자 없이 basePath만 반환. 실제 확장자는 GeneratorOutput에서 결정.

**Step 3: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 통과

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "refactor(obsidian-plugin): syncAll을 generator.extension 사용하도록 수정"
```

---

## Task 12: 전체 통합 테스트 및 마무리

**Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 모든 패키지 빌드 성공

**Step 2: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 통과

**Step 3: 타입체크**

Run: `pnpm typecheck`
Expected: 성공

**Step 4: 마일스톤 문서 업데이트**

```markdown
## Phase 10: 다중 출력 포맷 지원 ✅
- [x] FileGeneratorPort 인터페이스 정의 (출력 포맷 추상화)
- [x] ExcalidrawGenerator를 @petrify/generator-excalidraw로 이동
- [x] ExcalidrawFileGenerator 구현 (외부 에셋 방식)
- [x] @petrify/generator-markdown 패키지 생성
- [x] MarkdownFileGenerator 구현 (이미지 임베드 + OCR 텍스트)
- [x] 플러그인 설정 UI에 출력 포맷 선택 옵션 추가
```

**Step 5: 최종 커밋**

```bash
git add docs/milestones/v1.0-roadmap.md
git commit -m "docs: Phase 10 완료 - 다중 출력 포맷 지원"
```

---

## 요약

| Task | 설명 | 예상 시간 |
|------|------|-----------|
| 1 | FileGeneratorPort 인터페이스 정의 | 10분 |
| 2 | @petrify/generator-excalidraw 패키지 생성 | 10분 |
| 3 | core/excalidraw 모듈 이동 | 20분 |
| 4 | ExcalidrawFileGenerator 구현 | 30분 |
| 5 | @petrify/generator-markdown 패키지 생성 | 10분 |
| 6 | MarkdownFileGenerator 구현 | 20분 |
| 7 | core API 정리 | 15분 |
| 8 | ConversionPipeline 연동 | 25분 |
| 9 | 플러그인 설정 업데이트 | 15분 |
| 10 | 플러그인 Generator 연동 | 30분 |
| 11 | syncAll 및 삭제 로직 | 15분 |
| 12 | 통합 테스트 및 마무리 | 20분 |

**총 예상 시간: 약 3.5시간**
