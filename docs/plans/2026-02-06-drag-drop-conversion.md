# Drag & Drop 파일 변환 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 파일 탐색기에 파일을 드래그 & 드롭하면 자동으로 파서를 감지하여 excalidraw.md로 변환하고, 같은 확장자에 여러 파서가 있으면 사용자에게 선택 모달을 표시한다.

**Architecture:** ConversionPipeline이 `Map<string, ParserPort[]>`로 확장자당 여러 파서를 지원하고, `convertDroppedFile()`로 mtime 체크 없이 변환한다. 플러그인 레이어에서 ParserId enum으로 파서를 관리하고, WatchMapping에 parserId를 추가하여 watcher가 어떤 파서를 쓸지 명시한다. 드롭 핸들러는 파일 탐색기의 drop 이벤트를 감지하여 지원 확장자만 가로채고, 파서 충돌 시 선택 모달을 띄운다.

**Tech Stack:** TypeScript, Obsidian API, Vitest

---

## Task 1: ConversionPipeline을 Map 기반으로 변경

현재 `ConversionPipeline` 생성자가 `ParserPort[]`를 받아 내부적으로 `Map<string, ParserPort>`를 만든다. 이를 `Map<string, ParserPort>`를 직접 받도록 변경하여 플러그인이 id와 파서의 매핑을 제어할 수 있게 한다.

**Files:**
- Modify: `packages/core/src/conversion-pipeline.ts`
- Test: `packages/core/tests/conversion-pipeline.test.ts`

**Step 1: 테스트 수정 - Map 기반 생성자**

`packages/core/tests/conversion-pipeline.test.ts`에서 `ConversionPipeline` 생성자 호출을 Map 기반으로 변경한다.

```typescript
// 기존:
// const pipeline = new ConversionPipeline(
//   [parser], ocr, conversionState, { confidenceThreshold: 50 }
// );

// 변경:
const pipeline = new ConversionPipeline(
  new Map([['.note', parser]]),
  ocr, conversionState, { confidenceThreshold: 50 }
);
```

모든 테스트의 `new ConversionPipeline([parser], ...)` → `new ConversionPipeline(new Map([['.note', parser]]), ...)`로 변경.

**Step 2: 테스트가 실패하는지 확인**

Run: `pnpm --filter @petrify/core test`
Expected: FAIL - ConversionPipeline 생성자 시그니처 불일치

**Step 3: ConversionPipeline 생성자 변경**

`packages/core/src/conversion-pipeline.ts`:

```typescript
export class ConversionPipeline {
  private readonly parserMap: Map<string, ParserPort>;

  constructor(
    parsers: Map<string, ParserPort>,
    private readonly ocr: OcrPort | null,
    private readonly conversionState: ConversionStatePort,
    private readonly options: ConversionPipelineOptions,
  ) {
    this.parserMap = parsers;
  }

  // handleFileChange는 그대로 유지
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/core test`
Expected: PASS (전체)

**Step 5: 커밋**

```bash
git add packages/core/src/conversion-pipeline.ts packages/core/tests/conversion-pipeline.test.ts
git commit -m "refactor: ConversionPipeline 생성자를 Map<string, ParserPort> 기반으로 변경"
```

---

## Task 2: getParsersForExtension() 메서드 추가

확장자로 해당 파서 목록을 조회하는 메서드를 추가한다. 드롭 핸들러에서 파일 확장자로 파서를 찾을 때 사용한다. 현재는 확장자당 1개 파서만 지원하므로 배열로 래핑해서 반환한다.

**Files:**
- Modify: `packages/core/src/conversion-pipeline.ts`
- Test: `packages/core/tests/conversion-pipeline.test.ts`

**Step 1: 테스트 작성**

`packages/core/tests/conversion-pipeline.test.ts`에 추가:

```typescript
describe('getParsersForExtension', () => {
  it('등록된 확장자의 파서를 반환한다', () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]),
      ocr, conversionState, { confidenceThreshold: 50 }
    );

    const result = pipeline.getParsersForExtension('.note');
    expect(result).toEqual([parser]);
  });

  it('등록되지 않은 확장자는 빈 배열을 반환한다', () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]),
      ocr, conversionState, { confidenceThreshold: 50 }
    );

    const result = pipeline.getParsersForExtension('.txt');
    expect(result).toEqual([]);
  });

  it('대소문자를 무시하고 조회한다', () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]),
      ocr, conversionState, { confidenceThreshold: 50 }
    );

    const result = pipeline.getParsersForExtension('.NOTE');
    expect(result).toEqual([parser]);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/core test`
Expected: FAIL - getParsersForExtension is not a function

**Step 3: 구현**

`packages/core/src/conversion-pipeline.ts`에 메서드 추가:

```typescript
getParsersForExtension(ext: string): ParserPort[] {
  const parser = this.parserMap.get(ext.toLowerCase());
  return parser ? [parser] : [];
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/core test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/core/src/conversion-pipeline.ts packages/core/tests/conversion-pipeline.test.ts
git commit -m "feat: ConversionPipeline.getParsersForExtension() 메서드 추가"
```

---

## Task 3: convertDroppedFile() 메서드 추가

드롭된 파일을 변환하는 메서드. mtime 체크와 ConversionState를 건너뛰고, 지정된 파서로 바로 변환한다.

**Files:**
- Modify: `packages/core/src/conversion-pipeline.ts`
- Test: `packages/core/tests/conversion-pipeline.test.ts`

**Step 1: 테스트 작성**

```typescript
describe('convertDroppedFile', () => {
  it('지정된 파서로 변환하여 마크다운을 반환한다', async () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]),
      ocr, conversionState, { confidenceThreshold: 50 }
    );

    const result = await pipeline.convertDroppedFile(
      new ArrayBuffer(0), parser
    );

    expect(result).toContain('# Excalidraw Data');
  });

  it('OCR이 있으면 OCR 결과를 포함한다', async () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]),
      ocr, conversionState, { confidenceThreshold: 50 }
    );

    const result = await pipeline.convertDroppedFile(
      new ArrayBuffer(0), parser
    );

    expect(result).toContain('## OCR Text');
  });

  it('OCR이 없으면 OCR 없이 변환한다', async () => {
    const pipeline = new ConversionPipeline(
      new Map([['.note', parser]]),
      null, conversionState, { confidenceThreshold: 50 }
    );

    const result = await pipeline.convertDroppedFile(
      new ArrayBuffer(0), parser
    );

    expect(result).toContain('# Excalidraw Data');
    expect(result).not.toContain('## OCR Text');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/core test`
Expected: FAIL - convertDroppedFile is not a function

**Step 3: 구현**

`packages/core/src/conversion-pipeline.ts`에 추가:

```typescript
async convertDroppedFile(
  data: ArrayBuffer,
  parser: ParserPort,
): Promise<string> {
  if (this.ocr) {
    return convertToMdWithOcr(data, parser, this.ocr, {
      ocrConfidenceThreshold: this.options.confidenceThreshold,
    });
  }
  return convertToMd(data, parser);
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/core test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/core/src/conversion-pipeline.ts packages/core/tests/conversion-pipeline.test.ts
git commit -m "feat: ConversionPipeline.convertDroppedFile() 메서드 추가"
```

---

## Task 4: core index.ts export 업데이트

새로 추가된 public API를 export한다.

**Files:**
- Modify: `packages/core/src/index.ts`

**Step 1: export 추가**

변경 사항 없음 - `ConversionPipeline`은 이미 export됨. `getParsersForExtension`과 `convertDroppedFile`은 인스턴스 메서드이므로 별도 export 불필요.

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/core build`
Expected: 성공

**Step 3: 커밋 (변경 있을 경우만)**

---

## Task 5: 프론트매터 유틸 확장 - keep, source null, mtime null 지원

드롭 변환 시 프론트매터에 `keep: true`, `source: null`, `mtime: null`을 생성할 수 있도록 `createFrontmatter()`를 확장한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/utils/frontmatter.ts`
- Test: `packages/obsidian-plugin/tests/utils/frontmatter.test.ts`

**Step 1: 테스트 작성**

`packages/obsidian-plugin/tests/utils/frontmatter.test.ts`에 추가:

```typescript
it('keep: true 프론트매터를 생성한다', () => {
  const result = createFrontmatter({ source: null, mtime: null, keep: true });

  expect(result).toContain('source: null');
  expect(result).toContain('mtime: null');
  expect(result).toContain('keep: true');
  expect(result).toContain('excalidraw-plugin: parsed');
});

it('keep이 없으면 keep 필드를 생략한다', () => {
  const result = createFrontmatter({ source: '/path/to/file', mtime: 123 });

  expect(result).not.toContain('keep');
});

it('parseFrontmatter가 source: null을 파싱한다', () => {
  const content = `---
petrify:
  source: null
  mtime: null
  keep: true
excalidraw-plugin: parsed
---

content`;

  const result = parseFrontmatter(content);
  expect(result).not.toBeNull();
  expect(result!.source).toBeNull();
  expect(result!.mtime).toBeNull();
  expect(result!.keep).toBe(true);
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: FAIL

**Step 3: PetrifyFrontmatter 타입 변경**

```typescript
export interface PetrifyFrontmatter {
  source: string | null;
  mtime: number | null;
  keep?: boolean;
}
```

**Step 4: createFrontmatter 구현 변경**

```typescript
export function createFrontmatter(meta: PetrifyFrontmatter): string {
  const keepLine = meta.keep ? '\n  keep: true' : '';
  return `---
petrify:
  source: ${meta.source}
  mtime: ${meta.mtime}${keepLine}
excalidraw-plugin: parsed
---

`;
}
```

**Step 5: parseFrontmatter 구현 변경**

`source: null`과 `mtime: null`을 파싱할 수 있도록 수정:

```typescript
export function parseFrontmatter(content: string): PetrifyFrontmatter | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const sourceMatch = frontmatter.match(/source:\s*(.+)/);
  const mtimeMatch = frontmatter.match(/mtime:\s*(.+)/);

  if (!sourceMatch || !mtimeMatch) return null;

  const sourceValue = sourceMatch[1].trim();
  const mtimeValue = mtimeMatch[1].trim();
  const keepMatch = frontmatter.match(/keep:\s*(true|false)/);

  return {
    source: sourceValue === 'null' ? null : sourceValue,
    mtime: mtimeValue === 'null' ? null : parseInt(mtimeValue, 10),
    ...(keepMatch && { keep: keepMatch[1] === 'true' }),
  };
}
```

**Step 6: 기존 테스트 + 새 테스트 통과 확인**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: PASS

**Step 7: processFile 등 기존 호출부에서 타입 에러 없는지 확인**

`createFrontmatter({ source: event.id, mtime: event.mtime })`는 `string | null` 타입이므로 문제없음.

**Step 8: 커밋**

```bash
git add packages/obsidian-plugin/src/utils/frontmatter.ts packages/obsidian-plugin/tests/utils/frontmatter.test.ts
git commit -m "feat: 프론트매터에 keep, source null, mtime null 지원 추가"
```

---

## Task 6: ParserId enum 및 WatchMapping.parserId 추가

플러그인 레이어에서 파서 ID를 enum으로 관리하고, WatchMapping에 parserId 필드를 추가한다.

**Files:**
- Create: `packages/obsidian-plugin/src/parser-registry.ts`
- Modify: `packages/obsidian-plugin/src/settings.ts`
- Test: `packages/obsidian-plugin/tests/settings.test.ts`

**Step 1: ParserId enum 파일 생성**

`packages/obsidian-plugin/src/parser-registry.ts`:

```typescript
import type { ParserPort } from '@petrify/core';
import { ViwoodsParser } from '@petrify/parser-viwoods';

export enum ParserId {
  Viwoods = 'viwoods',
}

export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser()],
  ]);
}

export function getParserExtensions(parserId: string, parserMap: Map<string, ParserPort>): string[] {
  const parser = parserMap.get(parserId);
  return parser ? parser.extensions : [];
}
```

**Step 2: WatchMapping에 parserId 추가**

`packages/obsidian-plugin/src/settings.ts`:

```typescript
export interface WatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
}
```

**Step 3: DEFAULT_SETTINGS 업데이트**

기본값에 parserId가 없으므로 마이그레이션 처리 필요. `loadSettings()`에서 기존 매핑에 parserId가 없으면 기본값 할당:

이 처리는 Task 8(main.ts 통합)에서 한다.

**Step 4: 기존 settings 테스트 업데이트**

`packages/obsidian-plugin/tests/settings.test.ts`에서 WatchMapping에 parserId 추가:

```typescript
// 기존 테스트의 WatchMapping 객체에 parserId 추가
{ watchDir: '/path', outputDir: '/out', enabled: true, parserId: 'viwoods' }
```

**Step 5: 테스트 통과 확인**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: PASS

**Step 6: 커밋**

```bash
git add packages/obsidian-plugin/src/parser-registry.ts packages/obsidian-plugin/src/settings.ts packages/obsidian-plugin/tests/settings.test.ts
git commit -m "feat: ParserId enum 및 WatchMapping.parserId 추가"
```

---

## Task 7: 설정 UI에 파서 드롭다운 추가

WatchMapping 설정에 파서를 선택하는 드롭다운을 추가한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: 파서 목록을 받을 수 있도록 SettingsTabCallbacks 확장**

`packages/obsidian-plugin/src/settings-tab.ts`:

```typescript
import { ParserId } from './parser-registry.js';

export interface SettingsTabCallbacks {
  getSettings: () => PetrifySettings;
  saveSettings: (settings: PetrifySettings) => Promise<void>;
  saveDataOnly: (settings: PetrifySettings) => Promise<void>;
}
```

**Step 2: 드롭다운 추가**

`displayWatchMappings()` 내부, Watch Directory 설정 바로 아래에:

```typescript
new Setting(mappingContainer)
  .setName('Parser')
  .setDesc('File format parser for this directory')
  .addDropdown((dropdown) => {
    for (const id of Object.values(ParserId)) {
      dropdown.addOption(id, id);
    }
    dropdown.setValue(mapping.parserId || ParserId.Viwoods);
    dropdown.onChange(async (value) => {
      settings.watchMappings[index].parserId = value;
      await this.callbacks.saveSettings(settings);
    });
  });
```

**Step 3: 새 매핑 추가 시 기본 parserId 설정**

```typescript
settings.watchMappings.push({
  watchDir: '',
  outputDir: '',
  enabled: false,
  parserId: ParserId.Viwoods,
});
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "feat: 워치 매핑 설정에 파서 드롭다운 추가"
```

---

## Task 8: 파서 선택 모달 구현

같은 확장자를 지원하는 파서가 여러 개일 때 사용자에게 선택을 요청하는 모달. "Apply to all .{ext} files" 체크박스 포함. 모든 텍스트 영어.

**Files:**
- Create: `packages/obsidian-plugin/src/parser-select-modal.ts`
- Test: 모달은 Obsidian API에 의존하므로 빌드 확인으로 대체

**Step 1: 모달 구현**

`packages/obsidian-plugin/src/parser-select-modal.ts`:

```typescript
import { App, Modal, Setting } from 'obsidian';
import type { ParserPort } from '@petrify/core';

export interface ParserSelectResult {
  parser: ParserPort;
  applyToAll: boolean;
}

export class ParserSelectModal extends Modal {
  private selectedParser: ParserPort;
  private applyToAll = false;
  private resolve: ((result: ParserSelectResult | null) => void) | null = null;

  constructor(
    app: App,
    private readonly fileName: string,
    private readonly extension: string,
    private readonly parsers: Array<{ id: string; parser: ParserPort }>,
  ) {
    super(app);
    this.selectedParser = parsers[0].parser;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Parser' });
    contentEl.createEl('p', {
      text: `Choose a parser for "${this.fileName}":`,
    });

    const radioGroup = contentEl.createDiv();
    for (const { id, parser } of this.parsers) {
      const label = radioGroup.createEl('label', { cls: 'petrify-parser-option' });
      const radio = label.createEl('input', {
        type: 'radio',
        attr: { name: 'parser', value: id },
      });
      if (parser === this.selectedParser) {
        radio.checked = true;
      }
      label.appendText(` ${id}`);
      radio.addEventListener('change', () => {
        this.selectedParser = parser;
      });
      radioGroup.createEl('br');
    }

    new Setting(contentEl)
      .setName(`Apply to all ${this.extension} files`)
      .addToggle((toggle) =>
        toggle.setValue(false).onChange((value) => {
          this.applyToAll = value;
        })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('Convert').setCta().onClick(() => {
          this.resolve?.({ parser: this.selectedParser, applyToAll: this.applyToAll });
          this.close();
        })
      )
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => {
          this.resolve?.(null);
          this.close();
        })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve?.(null);
  }

  waitForSelection(): Promise<ParserSelectResult | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/parser-select-modal.ts
git commit -m "feat: 파서 선택 모달 구현 (Apply to all 체크박스 포함)"
```

---

## Task 9: 파일 탐색기 드롭 핸들러 구현

Obsidian 파일 탐색기에서 drop 이벤트를 감지하여, 지원하는 확장자의 파일을 변환한다.

**Files:**
- Create: `packages/obsidian-plugin/src/drop-handler.ts`

**Step 1: 드롭 핸들러 구현**

`packages/obsidian-plugin/src/drop-handler.ts`:

```typescript
import type { App } from 'obsidian';
import type { ParserPort, ConversionPipeline } from '@petrify/core';
import { ParserSelectModal } from './parser-select-modal.js';
import type { ParserSelectResult } from './parser-select-modal.js';
import { createFrontmatter } from './utils/frontmatter.js';
import { createLogger } from './logger.js';
import * as path from 'path';

const log = createLogger('Drop');

export class DropHandler {
  constructor(
    private readonly app: App,
    private readonly pipeline: ConversionPipeline,
    private readonly parserMap: Map<string, ParserPort>,
  ) {}

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
    if (!dropFolder) {
      log.error('Could not determine drop folder');
      return;
    }

    const parserChoices = new Map<string, ParserPort>();
    let converted = 0;
    let failed = 0;

    for (const file of supportedFiles) {
      try {
        const ext = path.extname(file.name).toLowerCase();
        let parser = parserChoices.get(ext);

        if (!parser) {
          parser = await this.resolveParser(file.name, ext);
          if (!parser) continue;
        }

        const data = await file.arrayBuffer();
        const result = await this.pipeline.convertDroppedFile(data, parser);
        const frontmatter = createFrontmatter({ source: null, mtime: null, keep: true });
        const outputName = path.basename(file.name, ext) + '.excalidraw.md';
        const outputPath = dropFolder === '/' ? outputName : `${dropFolder}/${outputName}`;

        await this.saveToVault(outputPath, frontmatter + result);
        converted++;
        log.info(`Converted: ${file.name}`);
      } catch (error) {
        failed++;
        log.error(`Conversion failed: ${file.name}`, error);
      }
    }

    if (converted > 0 || failed > 0) {
      log.notify(`Drop: ${converted} converted, ${failed} failed`);
    }
  };

  private isFileExplorer(target: HTMLElement): boolean {
    return target.closest('.nav-files-container') !== null;
  }

  private resolveDropFolder(target: HTMLElement): string | null {
    const navFolder = target.closest('[data-path]') as HTMLElement | null;
    if (navFolder) {
      const dataPath = navFolder.getAttribute('data-path');
      if (dataPath !== null) return dataPath;
    }
    return '/';
  }

  private filterSupportedFiles(files: FileList): File[] {
    const result: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name).toLowerCase();
      const parsers = this.pipeline.getParsersForExtension(ext);
      if (parsers.length > 0) {
        result.push(file);
      }
    }
    return result;
  }

  private async resolveParser(
    fileName: string,
    ext: string,
  ): Promise<ParserPort | null> {
    const parsers = this.pipeline.getParsersForExtension(ext);
    if (parsers.length === 0) return null;
    if (parsers.length === 1) return parsers[0];

    const parserEntries = parsers.map((parser) => {
      for (const [id, p] of this.parserMap) {
        if (p === parser) return { id, parser };
      }
      return { id: 'unknown', parser };
    });

    const modal = new ParserSelectModal(this.app, fileName, ext, parserEntries);
    modal.open();
    const result: ParserSelectResult | null = await modal.waitForSelection();

    if (!result) return null;
    return result.parser;
  }

  private async saveToVault(outputPath: string, content: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (dir && dir !== '.' && !(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.createFolder(dir);
    }
    if (await this.app.vault.adapter.exists(outputPath)) {
      await this.app.vault.adapter.write(outputPath, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
  }
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/drop-handler.ts
git commit -m "feat: 파일 탐색기 드롭 핸들러 구현"
```

---

## Task 10: syncAll에서 .note 하드코딩 제거

현재 `syncAll()`에서 `ext !== '.note'`로 하드코딩되어 있다. WatchMapping의 parserId를 사용하여 해당 파서가 지원하는 확장자만 처리하도록 변경한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: syncAll 수정**

`syncAll()` 내부에서:

```typescript
// 기존:
// if (ext !== '.note') continue;

// 변경:
const parserForMapping = this.parserMap.get(mapping.parserId);
if (!parserForMapping) continue;
const supportedExts = parserForMapping.extensions.map(e => e.toLowerCase());
// ... for loop 내부:
if (!supportedExts.includes(ext)) continue;
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "refactor: syncAll에서 .note 하드코딩 제거, parserId 기반으로 변경"
```

---

## Task 11: main.ts 통합 - 파이프라인 Map 전환, 드롭 핸들러 등록

모든 변경사항을 main.ts에 통합한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: import 추가**

```typescript
import { createParserMap, ParserId } from './parser-registry.js';
import { DropHandler } from './drop-handler.js';
```

**Step 2: parserMap 필드 추가**

```typescript
export default class PetrifyPlugin extends Plugin {
  // 기존 필드들...
  private parserMap!: Map<string, ParserPort>;
  private dropHandler!: DropHandler;
```

**Step 3: initializePipeline 수정**

```typescript
private initializePipeline(): void {
  // ...conversionState 설정...

  this.parserMap = createParserMap();

  const extensionMap = new Map<string, ParserPort>();
  for (const [, parser] of this.parserMap) {
    for (const ext of parser.extensions) {
      extensionMap.set(ext.toLowerCase(), parser);
    }
  }

  this.pipeline = new ConversionPipeline(
    extensionMap,
    this.ocr,
    conversionState,
    { confidenceThreshold: this.settings.ocr.confidenceThreshold },
  );
}
```

**Step 4: 드롭 핸들러 등록**

`onload()`에 추가:

```typescript
this.dropHandler = new DropHandler(this.app, this.pipeline, this.parserMap);
this.registerDomEvent(document, 'drop', this.dropHandler.handleDrop);
```

**Step 5: loadSettings에서 parserId 마이그레이션**

```typescript
private async loadSettings(): Promise<void> {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  this.settings.watchMappings = this.settings.watchMappings.map((m) => ({
    ...m,
    enabled: m.enabled ?? true,
    parserId: m.parserId ?? ParserId.Viwoods,
  }));
}
```

**Step 6: watcher에서 parserId 기반 파서 사용**

`startWatchers()`에서 매핑의 parserId로 파서를 조회:

```typescript
private async startWatchers(): Promise<void> {
  for (const mapping of this.settings.watchMappings) {
    if (!mapping.enabled) continue;
    if (!mapping.watchDir || !mapping.outputDir) continue;

    const parserForMapping = this.parserMap.get(mapping.parserId);
    if (!parserForMapping) {
      this.watcherLog.error(`Unknown parser: ${mapping.parserId}`);
      continue;
    }

    // watcher 생성 및 이벤트 핸들링은 기존과 동일
    // ...
  }
}
```

**Step 7: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 8: 전체 테스트**

Run: `pnpm test`
Expected: PASS

**Step 9: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat: main.ts 통합 - Map 기반 파이프라인, 드롭 핸들러, parserId 마이그레이션"
```

---

## Task 12: 수동 테스트

Obsidian에서 실제로 드롭 기능이 동작하는지 확인한다.

**Step 1: 플러그인 빌드**

Run: `pnpm --filter @petrify/obsidian-plugin build`

**Step 2: Obsidian에서 테스트**

1. 플러그인 리로드
2. .note 파일을 파일 탐색기 폴더에 드래그 & 드롭
3. 변환된 .excalidraw.md 파일이 생성되는지 확인
4. 프론트매터에 `keep: true`, `source: null`, `mtime: null` 포함 확인
5. 지원하지 않는 확장자 파일 드롭 시 Obsidian 기본 동작 유지 확인
6. 기존 watcher/sync 기능이 정상 동작하는지 확인

**Step 3: 문제 발견 시 수정 후 커밋**

---

## Task 13: code-simplifier를 이용한 전체 코드베이스 리팩터링

모든 기능 구현이 완료된 후, code-simplifier 에이전트를 사용하여 전체 코드베이스의 명확성, 일관성, 유지보수성을 점검하고 개선한다.

**Step 1: code-simplifier 에이전트 실행**

Task 도구를 사용하여 `code-simplifier` 서브에이전트를 실행한다. 전체 코드베이스를 대상으로 명확성, 일관성, 유지보수성을 점검하고 개선한다.

**Step 2: 전체 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS

**Step 3: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: code-simplifier를 이용한 전체 코드 정리"
```
