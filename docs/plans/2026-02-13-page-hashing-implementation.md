# Page Hashing 기반 증분 변환 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** mtime 기반 변환/스킵을 페이지 해싱 기반으로 교체하여 정확한 변경 감지와 페이지 단위 부분 업데이트를 지원한다.

**Architecture:** 2단계 해시 비교(fileHash → pageHashes)로 변경 감지. Generator 독립 방식으로 각 Generator가 자체 incrementalUpdate() 구현.

**Tech Stack:** TypeScript, Web Crypto API (SHA-1), vitest

**Design doc:** `docs/plans/2026-02-13-page-hashing-design.md`

---

## Task 1: core 해시 유틸리티

core에 SHA-1 해시 함수를 추가한다. Excalidraw generator의 `sha1Hex`와 동일한 로직이지만, core에서 독립적으로 사용할 수 있어야 한다.

**Files:**
- Create: `packages/core/src/hash.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/tests/hash.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/tests/hash.test.ts
import { describe, it, expect } from 'vitest';
import { sha1Hex } from '../src/hash.js';

describe('sha1Hex', () => {
  it('returns 40-character hex string', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const hash = await sha1Hex(data);
    expect(hash).toHaveLength(40);
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns same hash for same input', async () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(await sha1Hex(data)).toBe(await sha1Hex(data));
  });

  it('returns different hash for different input', async () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    expect(await sha1Hex(a)).not.toBe(await sha1Hex(b));
  });

  it('hashes ArrayBuffer', async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    const hash = await sha1Hex(new Uint8Array(data));
    expect(hash).toHaveLength(40);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/tests/hash.test.ts`
Expected: FAIL — `sha1Hex` not found

**Step 3: Write implementation**

```typescript
// packages/core/src/hash.ts
export async function sha1Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data as BufferSource);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Step 4: Export from index.ts**

`packages/core/src/index.ts`에 추가:
```typescript
export { sha1Hex } from './hash.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/core/tests/hash.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/hash.ts packages/core/tests/hash.test.ts packages/core/src/index.ts
git commit -m "feat(core): add sha1Hex hash utility"
```

---

## Task 2: ConversionMetadata 인터페이스 변경

`mtime`을 제거하고 `parser`, `fileHash`, `pageHashes`를 추가한다.

**Files:**
- Modify: `packages/core/src/ports/conversion-metadata.ts`
- Modify: `packages/core/src/ports/index.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Update ConversionMetadata**

```typescript
// packages/core/src/ports/conversion-metadata.ts
export interface PageHash {
  readonly id: string;
  readonly hash: string;
}

export interface ConversionMetadata {
  readonly source: string | null;
  readonly parser: string | null;
  readonly fileHash: string | null;
  readonly pageHashes: readonly PageHash[] | null;
  readonly keep?: boolean;
}

export interface ConversionMetadataPort {
  getMetadata(id: string): Promise<ConversionMetadata | undefined>;
  formatMetadata(metadata: ConversionMetadata): string;
}
```

**Step 2: Export PageHash from ports/index.ts**

```typescript
export type {
  ConversionMetadata,
  ConversionMetadataPort,
  PageHash,
} from './conversion-metadata.js';
```

**Step 3: Export PageHash from core index.ts**

```typescript
export type { ConversionMetadata, ConversionMetadataPort, PageHash } from './ports/conversion-metadata.js';
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: FAIL — `mtime` 참조하는 코드들에서 타입 에러 발생 (예상됨, 이후 Task에서 수정)

**Step 5: Commit (WIP)**

```bash
git add packages/core/src/ports/conversion-metadata.ts packages/core/src/ports/index.ts packages/core/src/index.ts
git commit -m "refactor(core): replace mtime with page hash fields in ConversionMetadata"
```

---

## Task 3: ParserPort에 id 필드 추가

생성자 주입 방식으로 각 파서에 id를 부여한다.

**Files:**
- Modify: `packages/core/src/ports/parser.ts`
- Modify: `packages/parser/viwoods/src/index.ts`
- Modify: `packages/parser/pdf/src/pdf-parser.ts`
- Modify: `packages/parser/supernote-x/src/index.ts`
- Modify: `packages/obsidian-plugin/src/parser-registry.ts`

**Step 1: Update ParserPort**

```typescript
// packages/core/src/ports/parser.ts
import type { Note } from '../models/index.js';

export interface ParserPort {
  readonly id: string;
  readonly extensions: string[];
  parse(data: ArrayBuffer): Promise<Note>;
}
```

**Step 2: Update ViwoodsParser**

```typescript
// packages/parser/viwoods/src/index.ts
export class ViwoodsParser implements ParserPort {
  readonly extensions = ['.note'];
  private readonly parser = new NoteParser();

  constructor(readonly id: string) {}

  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}
```

**Step 3: Update PdfParser**

`packages/parser/pdf/src/pdf-parser.ts` — 클래스 선언부에 `constructor(readonly id: string) {}` 추가.
기존 `readonly extensions = ['.pdf'];` 유지.

**Step 4: Update SupernoteXParser**

```typescript
// packages/parser/supernote-x/src/index.ts
export class SupernoteXParser implements ParserPort {
  readonly extensions = ['.note'];
  private readonly parser = new NoteParser();

  constructor(readonly id: string) {}

  parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}
```

**Step 5: Update parser-registry.ts**

```typescript
// packages/obsidian-plugin/src/parser-registry.ts
export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser(ParserId.Viwoods)],
    [ParserId.Pdf, new PdfParser(ParserId.Pdf)],
    [ParserId.SupernoteX, new SupernoteXParser(ParserId.SupernoteX)],
  ]);
}
```

**Step 6: Fix all existing tests that instantiate parsers**

각 파서 테스트에서 `new ViwoodsParser()` → `new ViwoodsParser('viwoods')` 등으로 수정. grep으로 찾기:
```bash
grep -rn "new ViwoodsParser\|new PdfParser\|new SupernoteXParser" packages/
```

**Step 7: Run typecheck + tests**

Run: `pnpm typecheck && pnpm vitest run packages/parser/`
Expected: typecheck은 여전히 mtime 관련 에러 있을 수 있으나, parser 패키지 테스트는 PASS

**Step 8: Commit**

```bash
git add packages/core/src/ports/parser.ts packages/parser/ packages/obsidian-plugin/src/parser-registry.ts
git commit -m "feat(core): add id field to ParserPort with constructor injection"
```

---

## Task 4: FileChangeEvent에서 mtime 제거

**Files:**
- Modify: `packages/core/src/ports/watcher.ts`
- Modify: `packages/obsidian-plugin/src/sync-orchestrator.ts`
- Modify: `packages/watcher/chokidar/src/chokidar-watcher.ts`
- Modify: `packages/watcher/google-drive/src/google-drive-watcher.ts`

**Step 1: Remove mtime from FileChangeEvent**

```typescript
// packages/core/src/ports/watcher.ts
export interface FileChangeEvent {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readData(): Promise<ArrayBuffer>;
}
```

**Step 2: Update SyncOrchestrator.syncFiles()**

`sync-orchestrator.ts:118-134` — `stat` 호출과 `mtime` 할당 제거:

```typescript
const event: FileChangeEvent = {
  id: fileRef,
  name: entry.name,
  extension: ext,
  readData: () => mappingFs.readFile(fileRef),
};
```

`stat` 호출은 더 이상 필요하지 않으므로 제거. `SyncFileSystem.stat()`도 이 Task에서는 유지하되, 사용처가 없으면 이후 정리.

**Step 3: Update watcher adapters**

`chokidar-watcher.ts`와 `google-drive-watcher.ts`에서 FileChangeEvent 생성 시 `mtime` 제거.
grep으로 찾기:
```bash
grep -rn "mtime" packages/watcher/
```

**Step 4: Fix all tests referencing mtime in FileChangeEvent**

```bash
grep -rn "mtime" packages/obsidian-plugin/tests/ packages/watcher/ packages/core/tests/
```

각 테스트의 FileChangeEvent mock에서 `mtime` 프로퍼티 제거.

**Step 5: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: mtime 관련 에러가 PetrifyService와 frontmatter 쪽에만 남아야 함

**Step 6: Commit**

```bash
git add packages/core/src/ports/watcher.ts packages/obsidian-plugin/src/sync-orchestrator.ts packages/watcher/ packages/obsidian-plugin/tests/ packages/core/tests/
git commit -m "refactor(core): remove mtime from FileChangeEvent"
```

---

## Task 5: PageDiff 로직

페이지 해시를 비교하여 변경된 페이지를 식별하는 순수 함수를 core에 추가한다.

**Files:**
- Create: `packages/core/src/page-diff.ts`
- Create: `packages/core/tests/page-diff.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing tests**

```typescript
// packages/core/tests/page-diff.test.ts
import { describe, it, expect } from 'vitest';
import { diffPages, type PageDiff } from '../src/page-diff.js';
import type { PageHash } from '../src/ports/conversion-metadata.js';

function page(id: string, hash: string) {
  return { id, hash };
}

describe('diffPages', () => {
  it('treats all pages as added when savedHashes is null', () => {
    const current = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, null);
    expect(diff.added).toEqual(['p1', 'p2']);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.type).toBe('full');
  });

  it('detects no changes', () => {
    const current = [page('p1', 'aaa'), page('p2', 'bbb')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('none');
    expect(diff.unchanged).toEqual(['p1', 'p2']);
  });

  it('detects content-only changes', () => {
    const current = [page('p1', 'aaa'), page('p2', 'CHANGED')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('content-only');
    expect(diff.changed).toEqual(['p2']);
    expect(diff.unchanged).toEqual(['p1']);
  });

  it('detects append', () => {
    const current = [page('p1', 'aaa'), page('p2', 'bbb'), page('p3', 'ccc')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('append');
    expect(diff.added).toEqual(['p3']);
    expect(diff.unchanged).toEqual(['p1', 'p2']);
  });

  it('detects append with content change', () => {
    const current = [page('p1', 'aaa'), page('p2', 'CHANGED'), page('p3', 'ccc')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('append');
    expect(diff.added).toEqual(['p3']);
    expect(diff.changed).toEqual(['p2']);
    expect(diff.unchanged).toEqual(['p1']);
  });

  it('detects structural change on middle insert', () => {
    const current = [page('p1', 'aaa'), page('new', 'xxx'), page('p2', 'bbb')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('structural');
  });

  it('detects structural change on deletion', () => {
    const current = [page('p1', 'aaa')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('structural');
    expect(diff.removed).toEqual(['p2']);
  });

  it('detects structural change on reorder', () => {
    const current = [page('p2', 'bbb'), page('p1', 'aaa')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('structural');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/tests/page-diff.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/core/src/page-diff.ts
import type { PageHash } from './ports/conversion-metadata.js';

export type DiffType = 'none' | 'content-only' | 'append' | 'structural' | 'full';

export interface PageDiff {
  readonly type: DiffType;
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
}

export function diffPages(
  current: readonly PageHash[],
  saved: readonly PageHash[] | null,
): PageDiff {
  if (!saved) {
    return {
      type: 'full',
      added: current.map((p) => p.id),
      changed: [],
      removed: [],
      unchanged: [],
    };
  }

  const savedMap = new Map(saved.map((p) => [p.id, p.hash]));
  const currentMap = new Map(current.map((p) => [p.id, p.hash]));

  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];

  for (const p of current) {
    const savedHash = savedMap.get(p.id);
    if (savedHash == null) {
      added.push(p.id);
    } else if (savedHash !== p.hash) {
      changed.push(p.id);
    } else {
      unchanged.push(p.id);
    }
  }

  for (const p of saved) {
    if (!currentMap.has(p.id)) {
      removed.push(p.id);
    }
  }

  if (added.length === 0 && changed.length === 0 && removed.length === 0) {
    return { type: 'none', added, changed, removed, unchanged };
  }

  if (removed.length > 0) {
    return { type: 'structural', added, changed, removed, unchanged };
  }

  // Check if saved ids are a prefix of current ids (preserving order)
  const savedIds = saved.map((p) => p.id);
  const currentIds = current.map((p) => p.id);
  const isPrefix = savedIds.every((id, i) => currentIds[i] === id);

  if (!isPrefix) {
    return { type: 'structural', added, changed, removed, unchanged };
  }

  if (added.length > 0) {
    return { type: 'append', added, changed, removed, unchanged };
  }

  return { type: 'content-only', added, changed, removed, unchanged };
}
```

**Step 4: Export from index.ts**

```typescript
export { diffPages, type DiffType, type PageDiff } from './page-diff.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/core/tests/page-diff.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/page-diff.ts packages/core/tests/page-diff.test.ts packages/core/src/index.ts
git commit -m "feat(core): add diffPages for page-level change detection"
```

---

## Task 6: OCR 마커 변경 — Excalidraw

`<!-- Page N -->` → `<!-- page: ${pageId} -->` 로 변경하고, 기존 output에서 페이지별 OCR을 추출하는 함수를 추가한다.

**Files:**
- Modify: `packages/generator/excalidraw/src/md-generator.ts`
- Modify: `packages/generator/excalidraw/tests/md-generator.test.ts`
- Create: `packages/generator/excalidraw/src/ocr-extractor.ts`
- Create: `packages/generator/excalidraw/tests/ocr-extractor.test.ts`

**Step 1: Update marker format in md-generator.ts**

`formatOcrSection` 메서드에서 마커 변경. `OcrTextResult`에 `pageId`가 필요하므로 인터페이스 확인 필요.

현재 `OcrTextResult`는 `{ pageIndex: number, texts: string[] }`. 이 Task에서는 **마커에 pageId를 기록할 수 있도록** `OcrTextResult`에 `pageId` 필드를 추가해야 한다.

먼저 `packages/core/src/ports/file-generator.ts`의 `OcrTextResult` 수정:

```typescript
export interface OcrTextResult {
  pageId: string;
  pageIndex: number;
  texts: string[];
}
```

md-generator.ts의 `formatOcrSection`:
```typescript
private formatOcrSection(ocrResults?: OcrTextResult[]): string {
  const lines = ['## OCR Text'];

  if (ocrResults && ocrResults.length > 0) {
    for (const result of ocrResults) {
      lines.push(`<!-- page: ${result.pageId} -->`);
      lines.push(result.texts.join('\n'));
    }
  }

  return `${lines.join('\n')}\n\n`;
}
```

**Step 2: Write OCR extractor tests**

```typescript
// packages/generator/excalidraw/tests/ocr-extractor.test.ts
import { describe, it, expect } from 'vitest';
import { extractOcrByPageId } from '../src/ocr-extractor.js';

describe('extractOcrByPageId', () => {
  it('extracts OCR text per page from excalidraw md content', () => {
    const content = `## OCR Text
<!-- page: page-1 -->
Hello world
<!-- page: page-2 -->
Second page text

# Excalidraw Data`;

    const result = extractOcrByPageId(content);
    expect(result.get('page-1')).toEqual(['Hello world']);
    expect(result.get('page-2')).toEqual(['Second page text']);
  });

  it('returns empty map when no OCR section', () => {
    const content = `# Excalidraw Data\n## Drawing`;
    const result = extractOcrByPageId(content);
    expect(result.size).toBe(0);
  });

  it('returns empty map when markers are malformed', () => {
    const content = `## OCR Text\nSome random text\n# Excalidraw Data`;
    const result = extractOcrByPageId(content);
    expect(result.size).toBe(0);
  });

  it('handles multi-line OCR text per page', () => {
    const content = `## OCR Text
<!-- page: p1 -->
Line one
Line two
Line three
<!-- page: p2 -->
Other text

# Excalidraw Data`;

    const result = extractOcrByPageId(content);
    expect(result.get('p1')).toEqual(['Line one', 'Line two', 'Line three']);
    expect(result.get('p2')).toEqual(['Other text']);
  });
});
```

**Step 3: Write OCR extractor implementation**

```typescript
// packages/generator/excalidraw/src/ocr-extractor.ts
const PAGE_MARKER_RE = /^<!-- page: (.+?) -->$/;

export function extractOcrByPageId(content: string): Map<string, string[]> {
  const result = new Map<string, string[]>();

  const ocrStart = content.indexOf('## OCR Text');
  if (ocrStart === -1) return result;

  const ocrEnd = content.indexOf('\n# ', ocrStart);
  const ocrSection = ocrEnd === -1 ? content.slice(ocrStart) : content.slice(ocrStart, ocrEnd);

  const lines = ocrSection.split('\n');
  let currentPageId: string | null = null;
  let currentTexts: string[] = [];

  for (const line of lines) {
    const match = line.match(PAGE_MARKER_RE);
    if (match) {
      if (currentPageId) {
        const trimmed = currentTexts.filter((t) => t.length > 0);
        if (trimmed.length > 0) result.set(currentPageId, trimmed);
      }
      currentPageId = match[1];
      currentTexts = [];
    } else if (currentPageId && line !== '## OCR Text') {
      currentTexts.push(line);
    }
  }

  if (currentPageId) {
    const trimmed = currentTexts.filter((t) => t.length > 0);
    if (trimmed.length > 0) result.set(currentPageId, trimmed);
  }

  return result;
}
```

**Step 4: Update existing md-generator tests**

기존 테스트에서 `<!-- Page 1 -->` 형태의 assertion을 `<!-- page: pageId -->` 형태로 변경.

**Step 5: Run tests**

Run: `pnpm vitest run packages/generator/excalidraw/`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/ports/file-generator.ts packages/generator/excalidraw/
git commit -m "feat(excalidraw): change OCR markers to page-id based format"
```

---

## Task 7: OCR 마커 추가 — Markdown

Markdown generator에 `<!-- page: ${pageId} -->` 마커를 추가하고, OCR 추출 함수를 만든다.

**Files:**
- Modify: `packages/generator/markdown/src/markdown-file-generator.ts`
- Modify: `packages/generator/markdown/tests/markdown-file-generator.test.ts`
- Create: `packages/generator/markdown/src/ocr-extractor.ts`
- Create: `packages/generator/markdown/tests/ocr-extractor.test.ts`

**Step 1: Update markdown-file-generator.ts**

OCR 섹션 생성 시 `<!-- page: ${pageId} -->` 마커 삽입:

```typescript
// generate() 내부 루프에서
const pageOcr = ocrResults?.find((r) => r.pageIndex === page.order);
if (pageOcr && pageOcr.texts.length > 0) {
  ocrParts.push(`<!-- page: ${pageOcr.pageId} -->`);
  ocrParts.push(pageOcr.texts.join('\n'));
}
```

**Step 2: Write OCR extractor for markdown**

Markdown 출력 형태:
```markdown
![[assets/name/page-1.png]]
![[assets/name/page-2.png]]

---

<!-- page: page-1 -->
First page text

<!-- page: page-2 -->
Second page text
```

```typescript
// packages/generator/markdown/src/ocr-extractor.ts
const PAGE_MARKER_RE = /^<!-- page: (.+?) -->$/;

export function extractOcrByPageId(content: string): Map<string, string[]> {
  const result = new Map<string, string[]>();

  const separatorIndex = content.indexOf('\n---\n');
  if (separatorIndex === -1) return result;

  const ocrSection = content.slice(separatorIndex + 5);
  const lines = ocrSection.split('\n');
  let currentPageId: string | null = null;
  let currentTexts: string[] = [];

  for (const line of lines) {
    const match = line.match(PAGE_MARKER_RE);
    if (match) {
      if (currentPageId) {
        const trimmed = currentTexts.filter((t) => t.length > 0);
        if (trimmed.length > 0) result.set(currentPageId, trimmed);
      }
      currentPageId = match[1];
      currentTexts = [];
    } else if (currentPageId) {
      currentTexts.push(line);
    }
  }

  if (currentPageId) {
    const trimmed = currentTexts.filter((t) => t.length > 0);
    if (trimmed.length > 0) result.set(currentPageId, trimmed);
  }

  return result;
}
```

**Step 3: Write tests, run, verify**

테스트 패턴은 Task 6의 excalidraw ocr-extractor 테스트와 동일한 구조.

**Step 4: Run tests**

Run: `pnpm vitest run packages/generator/markdown/`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/generator/markdown/
git commit -m "feat(markdown): add page-id OCR markers and extractor"
```

---

## Task 8: FileGeneratorPort에 incrementalUpdate 추가

**Files:**
- Modify: `packages/core/src/ports/file-generator.ts`
- Modify: `packages/core/src/ports/index.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Update FileGeneratorPort**

```typescript
// packages/core/src/ports/file-generator.ts
import type { Note } from '../models/index.js';
import type { Page } from '../models/page.js';

export interface OcrTextResult {
  pageId: string;
  pageIndex: number;
  texts: string[];
}

export interface PageUpdate {
  readonly page: Page;
  readonly ocrResult?: OcrTextResult;
}

export interface IncrementalInput {
  readonly existingContent: string;
  readonly existingAssets: ReadonlyMap<string, Uint8Array>;
  readonly updates: ReadonlyMap<string, PageUpdate>;
  readonly removedPageIds: readonly string[];
}

export interface GeneratorOutput {
  readonly content: string;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly extension: string;
}

export interface FileGeneratorPort {
  readonly id: string;
  readonly displayName: string;
  readonly extension: string;
  generate(
    note: Note,
    outputName: string,
    ocrResults?: OcrTextResult[],
  ): GeneratorOutput | Promise<GeneratorOutput>;
  incrementalUpdate(
    input: IncrementalInput,
    note: Note,
    outputName: string,
  ): GeneratorOutput | Promise<GeneratorOutput>;
}
```

**Step 2: Export new types**

`packages/core/src/ports/index.ts`와 `packages/core/src/index.ts`에서 `PageUpdate`, `IncrementalInput` export.

**Step 3: Commit**

```bash
git add packages/core/src/ports/file-generator.ts packages/core/src/ports/index.ts packages/core/src/index.ts
git commit -m "feat(core): add incrementalUpdate to FileGeneratorPort"
```

---

## Task 9: ExcalidrawFileGenerator incrementalUpdate 구현

**Files:**
- Modify: `packages/generator/excalidraw/src/excalidraw-file-generator.ts`
- Create: `packages/generator/excalidraw/tests/incremental-update.test.ts`

**Step 1: Write failing tests**

테스트 시나리오:
1. 단일 페이지 내용 변경 → 해당 element/file/asset만 교체
2. 끝에 페이지 추가 → 기존 유지 + 새 element/file/asset 추가
3. 페이지 삭제 → 해당 element/file/asset 제거

`incrementalUpdate`는 `IncrementalInput`의 `existingContent`(기존 .excalidraw.md)를 파싱하여 Excalidraw JSON을 수정하고 새로운 content를 생성한다.

**Step 2: Implement incrementalUpdate**

Excalidraw의 경우:
- 기존 content에서 compressed JSON을 추출 → decompress → parse
- `updates`의 각 페이지: element의 fileId/width/height 업데이트, files에서 해당 엔트리 교체, asset 교체
- 새 페이지(added): element 추가 (y좌표는 마지막 기존 element 아래), file/asset 추가
- `removedPageIds`: element/file/asset 제거
- re-compress → 새 content 생성
- OCR 섹션: `updates`의 ocrResult로 해당 마커 교체, unchanged는 기존 유지

**Step 3: Run tests, verify, commit**

```bash
git add packages/generator/excalidraw/
git commit -m "feat(excalidraw): implement incrementalUpdate"
```

---

## Task 10: MarkdownFileGenerator incrementalUpdate 구현

**Files:**
- Modify: `packages/generator/markdown/src/markdown-file-generator.ts`
- Create: `packages/generator/markdown/tests/incremental-update.test.ts`

**Step 1: Write failing tests**

테스트 시나리오:
1. 단일 페이지 내용 변경 → 해당 이미지 asset 교체 + OCR 섹션 해당 마커 교체
2. 끝에 페이지 추가 → 이미지 라인 추가 + asset 추가 + OCR 마커 추가
3. 페이지 삭제 → 해당 이미지 라인/asset/OCR 마커 제거

**Step 2: Implement incrementalUpdate**

Markdown의 경우:
- 기존 content를 `---` 구분자로 이미지 섹션/OCR 섹션 분리
- 이미지 섹션: 페이지별 `![[...]]` 라인 식별하여 교체/추가/제거
- OCR 섹션: `<!-- page: id -->` 마커로 식별하여 교체/추가/제거
- asset: 변경된 페이지의 이미지 파일 교체

**Step 3: Run tests, verify, commit**

```bash
git add packages/generator/markdown/
git commit -m "feat(markdown): implement incrementalUpdate"
```

---

## Task 11: PetrifyService 전체 흐름 재작성

핵심 변경. mtime 기반 로직을 해시 기반으로 전면 교체한다.

**Files:**
- Modify: `packages/core/src/petrify-service.ts`
- Modify: `packages/core/tests/petrify-service.test.ts`

**Step 1: Write failing tests for new flow**

테스트 시나리오:
1. keep:true → null 반환 (기존과 동일)
2. fileHash 동일 → null 반환 (스킵, 파싱 안 함)
3. fileHash 다름, 모든 pageHash 동일 → null 반환
4. fileHash 다름, 일부 pageHash 다름 → incrementalUpdate 호출
5. 최초 변환 (metadata 없음) → generate 호출
6. 파서 변경 → generate 호출 (전체 재변환)
7. 구조 변경 → generate 호출 + unchanged OCR 재사용
8. 드롭 변환 → generate 호출, metadata에 pageHashes 포함

**Step 2: Rewrite handleFileChange**

```typescript
async handleFileChange(
  event: FileChangeEvent,
  parser: ParserPort,
): Promise<ConversionResult | null> {
  // 1. 확장자 체크 (기존과 동일)
  const supportsExtension = parser.extensions.some(
    (supportedExt) => supportedExt.toLowerCase() === event.extension.toLowerCase(),
  );
  if (!supportsExtension) return null;

  // 2. keep 체크
  const savedMetadata = await this.metadataPort.getMetadata(event.id);
  if (savedMetadata?.keep) return null;

  // 3. fileHash 1차 필터
  const data = await event.readData();
  const fileHash = await sha1Hex(new Uint8Array(data));
  if (savedMetadata?.fileHash === fileHash) return null;

  // 4. 파싱
  let note: Note;
  try {
    note = await parser.parse(data);
  } catch (error) {
    throw new ConversionError('parse', error);
  }

  // 5. 페이지 해시 계산
  const currentPageHashes = await this.computePageHashes(note);

  // 6. 파서 변경 체크
  const parserChanged = savedMetadata?.parser != null && savedMetadata.parser !== parser.id;

  // 7. diff 계산
  const diff = diffPages(currentPageHashes, parserChanged ? null : (savedMetadata?.pageHashes ?? null));

  if (diff.type === 'none') return null;

  // 8. OCR + generate/incrementalUpdate
  const result = await this.processWithDiff(note, diff, parser, event, savedMetadata);

  // 9. metadata 구성
  const metadata: ConversionMetadata = {
    source: event.id,
    parser: parser.id,
    fileHash,
    pageHashes: currentPageHashes,
    keep: false,
  };

  return {
    content: result.content,
    assets: result.assets ?? new Map(),
    metadata,
  };
}
```

`processWithDiff` 메서드:
- `diff.type === 'full' || diff.type === 'structural'` → `convertData()` (전체 generate)
  - structural의 경우 기존 output에서 OCR 추출 시도, 실패 시 전체 OCR
- `diff.type === 'content-only' || diff.type === 'append'` → `incrementalUpdate()`
  - changed + added 페이지만 OCR → `generator.incrementalUpdate()` 호출

**Step 3: Update convertDroppedFile**

```typescript
async convertDroppedFile(
  data: ArrayBuffer,
  parser: ParserPort,
  outputName: string,
): Promise<ConversionResult> {
  const generatorOutput = await this.convertData(data, parser, outputName);
  const note = await parser.parse(data);  // 이미 convertData에서 파싱함 — 중복 방지를 위해 리팩토링 필요
  const pageHashes = await this.computePageHashes(note);
  const fileHash = await sha1Hex(new Uint8Array(data));

  const metadata: ConversionMetadata = {
    source: null,
    parser: parser.id,
    fileHash,
    pageHashes,
    keep: true,
  };

  return {
    content: generatorOutput.content,
    assets: generatorOutput.assets ?? new Map(),
    metadata,
  };
}
```

Note: `convertData()`가 내부에서 파싱을 하므로, 중복 파싱을 피하려면 파싱 결과를 공유하도록 리팩토링해야 한다. `convertData`를 note를 직접 받는 형태로 변경하는 것이 적절하다.

**Step 4: Remove shouldSkipConversion**

`shouldSkipConversion` 메서드 삭제. 로직이 `handleFileChange` 내부로 통합되었음.

**Step 5: Add computePageHashes helper**

```typescript
private async computePageHashes(note: Note): Promise<PageHash[]> {
  const sorted = [...note.pages].sort((a, b) => a.order - b.order);
  return Promise.all(
    sorted.map(async (page) => ({
      id: page.id,
      hash: await sha1Hex(page.imageData),
    })),
  );
}
```

**Step 6: Run tests**

Run: `pnpm vitest run packages/core/tests/petrify-service.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/core/src/petrify-service.ts packages/core/tests/petrify-service.test.ts
git commit -m "feat(core): rewrite PetrifyService with page-hash based change detection"
```

---

## Task 12: Frontmatter 유틸 업데이트

mtime → fileHash/pageHashes/parser 포맷으로 변경한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/utils/frontmatter.ts`
- Modify: `packages/obsidian-plugin/tests/utils/frontmatter.test.ts`
- Modify: `packages/obsidian-plugin/src/frontmatter-metadata-adapter.ts`

**Step 1: Write failing tests for new frontmatter format**

```typescript
describe('createFrontmatter', () => {
  it('creates frontmatter with page hashes', () => {
    const result = createFrontmatter({
      source: '/path/to/file.note',
      parser: 'viwoods',
      fileHash: 'abc123',
      pageHashes: [
        { id: 'page-1', hash: 'aaa' },
        { id: 'page-2', hash: 'bbb' },
      ],
      keep: false,
    });
    expect(result).toContain('parser: viwoods');
    expect(result).toContain('fileHash: abc123');
    expect(result).toContain('page-1: aaa');
    expect(result).toContain('page-2: bbb');
    expect(result).not.toContain('mtime');
  });
});

describe('parseFrontmatter', () => {
  it('parses page hashes from frontmatter', () => {
    const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: false
  pageHashes:
    page-1: aaa
    page-2: bbb
excalidraw-plugin: parsed
---

content`;
    const meta = parseFrontmatter(content);
    expect(meta?.parser).toBe('viwoods');
    expect(meta?.fileHash).toBe('abc123');
    expect(meta?.pageHashes).toEqual([
      { id: 'page-1', hash: 'aaa' },
      { id: 'page-2', hash: 'bbb' },
    ]);
  });
});
```

**Step 2: Rewrite createFrontmatter and parseFrontmatter**

frontmatter YAML 형태:
```yaml
---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: false
  pageHashes:
    page-1: aaa
    page-2: bbb
excalidraw-plugin: parsed
---
```

**Step 3: Update FrontmatterMetadataAdapter**

`getMetadata()`, `formatMetadata()` 에서 새 필드 사용.

**Step 4: Run tests, verify, commit**

```bash
git add packages/obsidian-plugin/src/utils/frontmatter.ts packages/obsidian-plugin/src/frontmatter-metadata-adapter.ts packages/obsidian-plugin/tests/
git commit -m "refactor(plugin): update frontmatter format for page hashing"
```

---

## Task 13: SyncOrchestrator 및 통합 테스트 수정

남은 컴파일 에러를 수정하고, 통합 테스트를 업데이트한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/sync-orchestrator.ts`
- Modify: `packages/obsidian-plugin/tests/sync-orchestrator.test.ts`
- Modify: `packages/obsidian-plugin/tests/petrify-service.integration.test.ts`
- Modify: `packages/obsidian-plugin/tests/process-file.test.ts`
- Modify: `packages/obsidian-plugin/tests/drop-handler.test.ts`
- Modify: `packages/obsidian-plugin/tests/conversion-saver.test.ts`

**Step 1: Fix SyncOrchestrator**

- `stat` 호출 제거 (Task 4에서 이미 처리했을 수 있음 — 확인)
- `SyncFileSystem.stat()` 인터페이스에서 제거 가능하면 제거

**Step 2: Fix all test mocks**

모든 테스트에서:
- `FileChangeEvent` mock에서 `mtime` 제거
- `ConversionMetadata` mock에서 `mtime` → `parser`, `fileHash`, `pageHashes`로 변경
- `ConversionResult.metadata`가 새 형식인지 확인

**Step 3: Run full test suite**

Run: `pnpm typecheck && pnpm test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add .
git commit -m "fix: update all tests and adapters for page hashing migration"
```

---

## Task 14: OcrTextResult에 pageId 반영 — PetrifyService

PetrifyService의 OCR 실행 부분에서 `OcrTextResult`에 `pageId`를 포함시킨다.

**Files:**
- Modify: `packages/core/src/petrify-service.ts`

**Step 1: Update convertData OCR mapping**

```typescript
// 기존
return { pageIndex: page.order, texts: filteredTexts };

// 변경
return { pageId: page.id, pageIndex: page.order, texts: filteredTexts };
```

**Step 2: Run tests, commit**

```bash
git add packages/core/src/petrify-service.ts
git commit -m "feat(core): include pageId in OcrTextResult"
```

---

## Task 15: Excalidraw generator에서 core sha1Hex 사용

Excalidraw generator가 자체 `sha1.ts` 대신 `@petrify/core`의 `sha1Hex`를 사용하도록 변경한다. 중복 제거.

**Files:**
- Modify: `packages/generator/excalidraw/src/excalidraw-generator.ts`
- Modify: `packages/generator/excalidraw/src/excalidraw-file-generator.ts`
- Delete: `packages/generator/excalidraw/src/sha1.ts`

**Step 1: Replace imports**

```typescript
// 기존
import { sha1Hex } from './sha1.js';

// 변경
import { sha1Hex } from '@petrify/core';
```

**Step 2: Delete sha1.ts, run tests, commit**

```bash
git add packages/generator/excalidraw/
git commit -m "refactor(excalidraw): use sha1Hex from @petrify/core"
```

---

## Task 16: 최종 검증 및 정리

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 2: Full test suite**

Run: `pnpm test`
Expected: ALL PASS

**Step 3: Lint**

Run: `pnpm biome check --write && pnpm biome check`
Expected: clean

**Step 4: CHANGELOG 업데이트**

`CHANGELOG.md`의 `[Unreleased]` 섹션에 추가:
```markdown
### Changed
- 파일 변경 감지를 mtime 기반에서 페이지 해싱 기반으로 변경
- 변경된 페이지만 OCR 재실행하는 증분 변환 지원
- OCR 마커를 페이지 ID 기반으로 통일
- ParserPort에 id 필드 추가
```

**Step 5: Squash commit**

```bash
git reset --soft main && git commit -m "feat: page hashing 기반 증분 변환"
```
