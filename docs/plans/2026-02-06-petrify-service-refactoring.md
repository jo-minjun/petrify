# PetrifyService 리팩토링 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ConversionPipeline을 PetrifyService로 확장하여 변환, 저장, 삭제 기능을 통합하고, ConversionStatePort를 ConversionMetadataPort로 개선한다.

**Architecture:** 헥사고날 아키텍처를 따라 core에 PetrifyService(유즈케이스)와 포트 인터페이스를 정의하고, obsidian-plugin에서 어댑터를 구현한다. 메타데이터 읽기/쓰기, 파일 시스템 접근을 포트로 추상화하여 의존성 역전을 유지한다.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces

---

## Task 1: ConversionMetadataPort 인터페이스 정의

**Files:**
- Create: `packages/core/src/ports/conversion-metadata.ts`
- Modify: `packages/core/src/ports/index.ts`

**Step 1: ConversionMetadata 타입과 ConversionMetadataPort 인터페이스 작성**

```typescript
// packages/core/src/ports/conversion-metadata.ts
export interface ConversionMetadata {
  readonly source: string | null;
  readonly mtime: number | null;
  readonly keep?: boolean;
}

export interface ConversionMetadataPort {
  getMetadata(id: string): Promise<ConversionMetadata | undefined>;
  formatMetadata(metadata: ConversionMetadata): string;
}
```

**Step 2: ports/index.ts에서 export 추가**

```typescript
// packages/core/src/ports/index.ts 에 추가
export type { ConversionMetadata, ConversionMetadataPort } from './conversion-metadata.js';
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @petrify/core build`
Expected: 성공

**Step 4: 커밋**

```bash
git add packages/core/src/ports/conversion-metadata.ts packages/core/src/ports/index.ts
git commit -m "feat(core): ConversionMetadataPort 인터페이스 정의"
```

---

## Task 2: FileSystemPort 인터페이스 정의

**Files:**
- Create: `packages/core/src/ports/file-system.ts`
- Modify: `packages/core/src/ports/index.ts`

**Step 1: FileSystemPort 인터페이스 작성**

```typescript
// packages/core/src/ports/file-system.ts
export interface FileSystemPort {
  writeFile(path: string, content: string): Promise<void>;
  writeAsset(dir: string, name: string, data: Uint8Array): Promise<string>;
  exists(path: string): Promise<boolean>;
}
```

**Step 2: ports/index.ts에서 export 추가**

```typescript
// packages/core/src/ports/index.ts 에 추가
export type { FileSystemPort } from './file-system.js';
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @petrify/core build`
Expected: 성공

**Step 4: 커밋**

```bash
git add packages/core/src/ports/file-system.ts packages/core/src/ports/index.ts
git commit -m "feat(core): FileSystemPort 인터페이스 정의"
```

---

## Task 3: PetrifyService 기본 구조 작성 (변환 기능)

**Files:**
- Create: `packages/core/src/petrify-service.ts`
- Create: `packages/core/src/__tests__/petrify-service.test.ts`

**Step 1: 테스트 파일 작성 - handleFileChange 스킵 케이스**

```typescript
// packages/core/src/__tests__/petrify-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PetrifyService } from '../petrify-service.js';
import type { ParserPort } from '../ports/parser.js';
import type { FileGeneratorPort, GeneratorOutput } from '../ports/file-generator.js';
import type { ConversionMetadataPort, ConversionMetadata } from '../ports/conversion-metadata.js';
import type { FileSystemPort } from '../ports/file-system.js';
import type { FileChangeEvent } from '../ports/watcher.js';

function createMockParserPort(): ParserPort {
  return {
    extensions: ['.note'],
    parse: vi.fn(),
  };
}

function createMockGeneratorPort(): FileGeneratorPort {
  return {
    extension: '.excalidraw.md',
    generate: vi.fn(),
  };
}

function createMockMetadataPort(): ConversionMetadataPort {
  return {
    getMetadata: vi.fn(),
    formatMetadata: vi.fn(),
  };
}

function createMockFileSystemPort(): FileSystemPort {
  return {
    writeFile: vi.fn(),
    writeAsset: vi.fn(),
    exists: vi.fn(),
  };
}

describe('PetrifyService', () => {
  describe('handleFileChange', () => {
    it('지원하지 않는 확장자는 null 반환', async () => {
      const parsers = new Map<string, ParserPort>();
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        createMockMetadataPort(),
        createMockFileSystemPort(),
        { confidenceThreshold: 0.5 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.unknown',
        name: 'file.unknown',
        extension: '.unknown',
        mtime: Date.now(),
        readData: vi.fn(),
      };

      const result = await service.handleFileChange(event, 'output');
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/core test`
Expected: FAIL - PetrifyService 모듈 없음

**Step 3: PetrifyService 기본 구조 작성**

```typescript
// packages/core/src/petrify-service.ts
import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import type { ConversionMetadataPort, ConversionMetadata } from './ports/conversion-metadata.js';
import type { FileSystemPort } from './ports/file-system.js';
import type { FileChangeEvent } from './ports/watcher.js';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from './ports/file-generator.js';
import { filterOcrByConfidence } from './ocr/filter.js';
import { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';

export interface PetrifyServiceOptions {
  readonly confidenceThreshold: number;
}

export class PetrifyService {
  constructor(
    private readonly parsers: Map<string, ParserPort>,
    private readonly generator: FileGeneratorPort,
    private readonly ocr: OcrPort | null,
    private readonly metadataPort: ConversionMetadataPort,
    private readonly fileSystem: FileSystemPort,
    private readonly options: PetrifyServiceOptions,
  ) {}

  getParsersForExtension(ext: string): ParserPort[] {
    const parser = this.parsers.get(ext.toLowerCase());
    return parser ? [parser] : [];
  }

  async handleFileChange(event: FileChangeEvent, outputDir: string): Promise<string | null> {
    const parser = this.parsers.get(event.extension.toLowerCase());
    if (!parser) {
      return null;
    }

    const lastMetadata = await this.metadataPort.getMetadata(event.id);
    if (lastMetadata?.mtime !== null && lastMetadata?.mtime !== undefined && event.mtime <= lastMetadata.mtime) {
      return null;
    }

    const data = await event.readData();
    const baseName = event.name.replace(/\.[^/.]+$/, '');
    const result = await this.convertData(data, parser, baseName);

    const metadata: ConversionMetadata = {
      source: event.id,
      mtime: event.mtime,
    };

    return this.saveOutput(result, outputDir, baseName, metadata);
  }

  async convertDroppedFile(
    data: ArrayBuffer,
    parser: ParserPort,
    outputDir: string,
    outputName: string,
  ): Promise<string> {
    const result = await this.convertData(data, parser, outputName);

    const metadata: ConversionMetadata = {
      source: null,
      mtime: null,
      keep: true,
    };

    return this.saveOutput(result, outputDir, outputName, metadata);
  }

  async handleFileDelete(outputPath: string): Promise<boolean> {
    const metadata = await this.metadataPort.getMetadata(outputPath);

    if (!metadata) return false;
    if (metadata.keep) return false;

    return true;
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

  private async saveOutput(
    result: GeneratorOutput,
    outputDir: string,
    outputName: string,
    metadata: ConversionMetadata,
  ): Promise<string> {
    const frontmatter = this.metadataPort.formatMetadata(metadata);
    const outputPath = `${outputDir}/${outputName}${this.generator.extension}`;

    const content = frontmatter + result.content;
    await this.fileSystem.writeFile(outputPath, content);

    if (result.assets) {
      const assetsDir = `${outputDir}/assets/${outputName}`;
      for (const asset of result.assets) {
        await this.fileSystem.writeAsset(assetsDir, asset.name, asset.data);
      }
    }

    return outputPath;
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/core test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/core/src/petrify-service.ts packages/core/src/__tests__/petrify-service.test.ts
git commit -m "feat(core): PetrifyService 기본 구조 작성"
```

---

## Task 4: PetrifyService 추가 테스트

**Files:**
- Modify: `packages/core/src/__tests__/petrify-service.test.ts`

**Step 1: mtime 비교로 스킵하는 케이스 테스트 추가**

```typescript
// packages/core/src/__tests__/petrify-service.test.ts 에 추가
it('mtime이 같거나 이전이면 null 반환', async () => {
  const mockParser = createMockParserPort();
  const parsers = new Map<string, ParserPort>([['.note', mockParser]]);

  const mockMetadata = createMockMetadataPort();
  vi.mocked(mockMetadata.getMetadata).mockResolvedValue({
    source: '/path/to/file.note',
    mtime: 1000,
  });

  const service = new PetrifyService(
    parsers,
    createMockGeneratorPort(),
    null,
    mockMetadata,
    createMockFileSystemPort(),
    { confidenceThreshold: 0.5 },
  );

  const event: FileChangeEvent = {
    id: '/path/to/file.note',
    name: 'file.note',
    extension: '.note',
    mtime: 1000,
    readData: vi.fn(),
  };

  const result = await service.handleFileChange(event, 'output');
  expect(result).toBeNull();
});
```

**Step 2: handleFileDelete 테스트 추가**

```typescript
// packages/core/src/__tests__/petrify-service.test.ts 에 추가
describe('handleFileDelete', () => {
  it('메타데이터가 없으면 false 반환', async () => {
    const mockMetadata = createMockMetadataPort();
    vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

    const service = new PetrifyService(
      new Map(),
      createMockGeneratorPort(),
      null,
      mockMetadata,
      createMockFileSystemPort(),
      { confidenceThreshold: 0.5 },
    );

    const result = await service.handleFileDelete('output/file.excalidraw.md');
    expect(result).toBe(false);
  });

  it('keep이 true면 false 반환', async () => {
    const mockMetadata = createMockMetadataPort();
    vi.mocked(mockMetadata.getMetadata).mockResolvedValue({
      source: null,
      mtime: null,
      keep: true,
    });

    const service = new PetrifyService(
      new Map(),
      createMockGeneratorPort(),
      null,
      mockMetadata,
      createMockFileSystemPort(),
      { confidenceThreshold: 0.5 },
    );

    const result = await service.handleFileDelete('output/file.excalidraw.md');
    expect(result).toBe(false);
  });

  it('삭제 가능하면 true 반환', async () => {
    const mockMetadata = createMockMetadataPort();
    vi.mocked(mockMetadata.getMetadata).mockResolvedValue({
      source: '/path/to/file.note',
      mtime: 1000,
    });

    const service = new PetrifyService(
      new Map(),
      createMockGeneratorPort(),
      null,
      mockMetadata,
      createMockFileSystemPort(),
      { confidenceThreshold: 0.5 },
    );

    const result = await service.handleFileDelete('output/file.excalidraw.md');
    expect(result).toBe(true);
  });
});
```

**Step 3: 테스트 통과 확인**

Run: `pnpm --filter @petrify/core test`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/core/src/__tests__/petrify-service.test.ts
git commit -m "test(core): PetrifyService 추가 테스트"
```

---

## Task 5: core 패키지 export 정리

**Files:**
- Modify: `packages/core/src/index.ts`
- Delete: `packages/core/src/ports/conversion-state.ts`

**Step 1: index.ts에서 PetrifyService export 추가, ConversionPipeline 제거**

```typescript
// packages/core/src/index.ts
// 기존 ConversionPipeline export 제거
// export { ConversionPipeline } from './conversion-pipeline.js';

// PetrifyService export 추가
export { PetrifyService } from './petrify-service.js';
export type { PetrifyServiceOptions } from './petrify-service.js';
```

**Step 2: ports/index.ts에서 ConversionStatePort export 제거**

```typescript
// packages/core/src/ports/index.ts
// 기존 제거
// export type { ConversionStatePort } from './conversion-state.js';
```

**Step 3: conversion-state.ts 파일 삭제**

```bash
rm packages/core/src/ports/conversion-state.ts
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @petrify/core build`
Expected: 성공

**Step 5: 커밋**

```bash
git add packages/core/src/index.ts packages/core/src/ports/index.ts
git rm packages/core/src/ports/conversion-state.ts
git commit -m "refactor(core): ConversionPipeline을 PetrifyService로 교체"
```

---

## Task 6: FrontmatterMetadataAdapter 구현

**Files:**
- Create: `packages/obsidian-plugin/src/frontmatter-metadata-adapter.ts`
- Delete: `packages/obsidian-plugin/src/frontmatter-conversion-state.ts`

**Step 1: FrontmatterMetadataAdapter 작성**

```typescript
// packages/obsidian-plugin/src/frontmatter-metadata-adapter.ts
import type { ConversionMetadataPort, ConversionMetadata } from '@petrify/core';
import { parseFrontmatter, createFrontmatter } from './utils/frontmatter.js';

export class FrontmatterMetadataAdapter implements ConversionMetadataPort {
  constructor(
    private readonly readFile: (path: string) => Promise<string>,
  ) {}

  async getMetadata(id: string): Promise<ConversionMetadata | undefined> {
    try {
      const content = await this.readFile(id);
      const meta = parseFrontmatter(content);
      if (!meta) return undefined;

      return {
        source: meta.source,
        mtime: meta.mtime,
        keep: meta.keep,
      };
    } catch {
      return undefined;
    }
  }

  formatMetadata(metadata: ConversionMetadata): string {
    return createFrontmatter({
      source: metadata.source,
      mtime: metadata.mtime,
      keep: metadata.keep,
    });
  }
}
```

**Step 2: 기존 파일 삭제**

```bash
rm packages/obsidian-plugin/src/frontmatter-conversion-state.ts
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 실패 (main.ts에서 아직 사용 중)

**Step 4: 커밋 (WIP)**

```bash
git add packages/obsidian-plugin/src/frontmatter-metadata-adapter.ts
git rm packages/obsidian-plugin/src/frontmatter-conversion-state.ts
git commit -m "wip: FrontmatterMetadataAdapter 구현"
```

---

## Task 7: ObsidianFileSystemAdapter 구현

**Files:**
- Create: `packages/obsidian-plugin/src/obsidian-file-system-adapter.ts`

**Step 1: ObsidianFileSystemAdapter 작성**

```typescript
// packages/obsidian-plugin/src/obsidian-file-system-adapter.ts
import * as path from 'path';
import type { App } from 'obsidian';
import type { FileSystemPort } from '@petrify/core';

export class ObsidianFileSystemAdapter implements FileSystemPort {
  constructor(private readonly app: App) {}

  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    await this.app.vault.adapter.write(filePath, content);
  }

  async writeAsset(dir: string, name: string, data: Uint8Array): Promise<string> {
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    const assetPath = path.join(dir, name);
    await this.app.vault.adapter.writeBinary(assetPath, data);
    return assetPath;
  }

  async exists(filePath: string): Promise<boolean> {
    return this.app.vault.adapter.exists(filePath);
  }
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 실패 (main.ts 수정 필요)

**Step 3: 커밋 (WIP)**

```bash
git add packages/obsidian-plugin/src/obsidian-file-system-adapter.ts
git commit -m "wip: ObsidianFileSystemAdapter 구현"
```

---

## Task 8: main.ts 리팩토링 - PetrifyService 적용

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: import 수정**

```typescript
// packages/obsidian-plugin/src/main.ts
// 기존
// import { ConversionPipeline } from '@petrify/core';
// import { FrontmatterConversionState } from './frontmatter-conversion-state.js';

// 변경
import { PetrifyService } from '@petrify/core';
import { FrontmatterMetadataAdapter } from './frontmatter-metadata-adapter.js';
import { ObsidianFileSystemAdapter } from './obsidian-file-system-adapter.js';
```

**Step 2: 필드 및 초기화 수정**

```typescript
// 기존
// private pipeline!: ConversionPipeline;

// 변경
private petrifyService!: PetrifyService;
```

**Step 3: initializePipeline → initializeService 메서드 수정**

```typescript
private initializeService(): void {
  const adapter = this.app.vault.adapter as FileSystemAdapter;
  const vaultPath = adapter.getBasePath();

  const metadataAdapter = new FrontmatterMetadataAdapter(async (id: string) => {
    const outputPath = this.getOutputPathForId(id);
    const fullPath = path.join(vaultPath, outputPath);
    return fs.readFile(fullPath, 'utf-8');
  });

  const fileSystemAdapter = new ObsidianFileSystemAdapter(this.app);

  this.parserMap = createParserMap();
  this.generator = createGenerator(this.settings.outputFormat);

  const extensionMap = new Map<string, ParserPort>();
  for (const [, parser] of this.parserMap) {
    for (const ext of parser.extensions) {
      extensionMap.set(ext.toLowerCase(), parser);
    }
  }

  this.petrifyService = new PetrifyService(
    extensionMap,
    this.generator,
    this.ocr,
    metadataAdapter,
    fileSystemAdapter,
    { confidenceThreshold: this.settings.ocr.confidenceThreshold },
  );
}
```

**Step 4: processFile 단순화**

```typescript
private async processFile(event: FileChangeEvent, outputDir: string): Promise<boolean> {
  const outputPath = await this.petrifyService.handleFileChange(event, outputDir);
  if (!outputPath) return false;

  this.convertLog.info(`Converted: ${event.name} -> ${outputPath}`);
  return true;
}
```

**Step 5: handleDeletedSource 단순화**

```typescript
private async handleDeletedSource(outputPath: string): Promise<void> {
  if (!(await this.app.vault.adapter.exists(outputPath))) return;

  const canDelete = await this.petrifyService.handleFileDelete(outputPath);
  if (!canDelete) {
    this.convertLog.info(`Kept (protected): ${outputPath}`);
    return;
  }

  const file = this.app.vault.getAbstractFileByPath(outputPath);
  if (file) {
    await this.app.vault.trash(file, true);
    this.convertLog.info(`Deleted: ${outputPath}`);
  }
}
```

**Step 6: onload에서 메서드 호출 수정**

```typescript
// 기존
// this.initializePipeline();
// 변경
this.initializeService();
```

**Step 7: restart 메서드 수정**

```typescript
private async restart(): Promise<void> {
  await Promise.all(this.watchers.map((w) => w.stop()));
  this.watchers = [];
  this.initializeService();
  await this.startWatchers();
}
```

**Step 8: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 9: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "refactor(plugin): PetrifyService 적용"
```

---

## Task 9: drop-handler.ts 리팩토링

**Files:**
- Modify: `packages/obsidian-plugin/src/drop-handler.ts`

**Step 1: import 및 생성자 수정**

```typescript
// packages/obsidian-plugin/src/drop-handler.ts
import * as path from 'path';
import type { App } from 'obsidian';
import type { PetrifyService, ParserPort } from '@petrify/core';
import { createLogger } from './logger.js';
import { ParserSelectModal } from './parser-select-modal.js';

const log = createLogger('Drop');

export class DropHandler {
  private readonly parserChoices = new Map<string, ParserPort>();

  constructor(
    private readonly app: App,
    private readonly petrifyService: PetrifyService,
    private readonly parserMap: Map<string, ParserPort>,
  ) {}
```

**Step 2: handleDrop 메서드 단순화**

```typescript
handleDrop = async (evt: DragEvent): Promise<void> => {
  const target = evt.target as HTMLElement;
  if (!this.isFileExplorer(target)) return;

  const files = evt.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const supportedFiles = this.filterSupportedFiles(files);
  if (supportedFiles.length === 0) return;

  evt.preventDefault();
  evt.stopPropagation();

  const dropFolder = this.resolveDropFolder(target);

  let converted = 0;
  let failed = 0;

  for (const file of supportedFiles) {
    try {
      const ext = path.extname(file.name).toLowerCase();
      const cached = this.parserChoices.get(ext);
      const parser = cached ?? await this.resolveParser(file.name, ext);
      if (!parser) continue;

      const data = await file.arrayBuffer();
      const baseName = path.basename(file.name, ext);
      const outputPath = await this.petrifyService.convertDroppedFile(data, parser, dropFolder, baseName);

      converted++;
      log.info(`Converted: ${file.name} -> ${outputPath}`);
    } catch (error) {
      failed++;
      log.error(`Conversion failed: ${file.name}`, error);
    }
  }

  if (converted > 0 || failed > 0) {
    log.notify(`Drop: ${converted} converted, ${failed} failed`);
  }
};
```

**Step 3: filterSupportedFiles 메서드 수정**

```typescript
private filterSupportedFiles(files: FileList): File[] {
  return Array.from(files).filter((file) => {
    const ext = path.extname(file.name).toLowerCase();
    return this.petrifyService.getParsersForExtension(ext).length > 0;
  });
}
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/drop-handler.ts
git commit -m "refactor(plugin): DropHandler에 PetrifyService 적용"
```

---

## Task 10: main.ts에서 DropHandler 생성자 수정

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: DropHandler 생성 수정**

```typescript
// 기존
// this.dropHandler = new DropHandler(this.app, this.pipeline, this.parserMap);

// 변경
this.dropHandler = new DropHandler(this.app, this.petrifyService, this.parserMap);
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "fix(plugin): DropHandler에 PetrifyService 전달"
```

---

## Task 11: 불필요한 파일 정리

**Files:**
- Delete: `packages/core/src/conversion-pipeline.ts`
- Delete: `packages/obsidian-plugin/src/utils/save-output.ts`

**Step 1: conversion-pipeline.ts 삭제**

```bash
rm packages/core/src/conversion-pipeline.ts
```

**Step 2: save-output.ts 삭제**

```bash
rm packages/obsidian-plugin/src/utils/save-output.ts
```

**Step 3: save-output.ts import 제거 (main.ts에서)**

main.ts에서 `saveGeneratorOutput` import가 있다면 제거

**Step 4: 빌드 확인**

Run: `pnpm build`
Expected: 성공

**Step 5: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 통과

**Step 6: 커밋**

```bash
git rm packages/core/src/conversion-pipeline.ts packages/obsidian-plugin/src/utils/save-output.ts
git add packages/obsidian-plugin/src/main.ts
git commit -m "chore: 불필요한 파일 정리"
```

---

## Task 12: syncAll 메서드 리팩토링

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: syncAll 내 고아 파일 정리 로직 수정**

기존 `parseFrontmatter` 직접 호출을 `petrifyService.handleFileDelete` 사용으로 변경

```typescript
// syncAll 내 고아 파일 정리 부분
for (const outputFile of outputFiles) {
  if (!outputFile.endsWith(this.generator.extension)) continue;

  const outputPath = path.join(mapping.outputDir, outputFile);
  const canDelete = await this.petrifyService.handleFileDelete(outputPath);

  if (!canDelete) continue;

  // source 파일 존재 확인은 별도로 필요
  const metadata = await this.metadataAdapter.getMetadata(outputPath);
  if (!metadata?.source) continue;

  try {
    await fs.access(metadata.source);
  } catch {
    const file = this.app.vault.getAbstractFileByPath(outputPath);
    if (file) {
      await this.app.vault.trash(file, true);
      this.convertLog.info(`Cleaned orphan: ${outputPath}`);
      deleted++;

      const baseName = outputFile.replace(this.generator.extension, '');
      const assetsDir = path.join(mapping.outputDir, 'assets', baseName);
      const assetsFullPath = path.join(vaultPath, assetsDir);
      try {
        await fs.rm(assetsFullPath, { recursive: true });
        this.convertLog.info(`Cleaned orphan assets: ${assetsDir}`);
      } catch {
        // ignore if assets folder doesn't exist
      }
    }
  }
}
```

**Step 2: metadataAdapter를 클래스 필드로 추가**

```typescript
private metadataAdapter!: FrontmatterMetadataAdapter;
```

initializeService에서 할당:
```typescript
this.metadataAdapter = metadataAdapter;
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "refactor(plugin): syncAll에서 PetrifyService 활용"
```

---

## Task 13: 최종 검증

**Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 모든 패키지 빌드 성공

**Step 2: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 통과

**Step 3: 타입 체크**

Run: `pnpm --filter @petrify/core exec tsc --noEmit`
Run: `pnpm --filter @petrify/obsidian-plugin exec tsc --noEmit`
Expected: 에러 없음

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: PetrifyService로 유즈케이스 통합 완료"
```

---

## 요약

| 변경 전 | 변경 후 |
|---------|---------|
| `ConversionStatePort` | `ConversionMetadataPort` |
| `ConversionPipeline` | `PetrifyService` |
| `FrontmatterConversionState` | `FrontmatterMetadataAdapter` |
| 없음 | `FileSystemPort` |
| 없음 | `ObsidianFileSystemAdapter` |
| `saveGeneratorOutput` (유틸) | `PetrifyService.saveOutput` (내부) |
