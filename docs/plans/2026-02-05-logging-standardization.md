# 로깅 표준화 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 흩어진 console.log/Notice를 네임스페이스 기반 로거로 표준화하고, core에 변환 상세 로깅을 추가한다.

**Architecture:** Core(`ConversionPipeline`)는 `console.log`로 변환 과정(스킵 사유 등)을 직접 로깅한다. Plugin은 `createLogger()` 팩토리를 통해 Watcher/Sync/Convert 네임스페이스 로거를 생성하여 console + Notice를 관리한다. Notice는 최종 결과에만 사용한다.

**Tech Stack:** Obsidian API (`Notice`), `console.log`

---

## 로깅 메시지 맵

### Console 포맷: `[Petrify:{Namespace}] {message}`
### Notice 포맷: `Petrify: {message}` (네임스페이스 없음)

| Namespace | 상황 | Console | Notice |
|-----------|------|---------|--------|
| `Watcher` | 파일 감지 | `info` | - |
| `Watcher` | 감시 에러 | `error` | `notify` |
| `Sync` | 동기화 시작 | `info` | - |
| `Sync` | 이미 진행 중 | `info` | `notify` |
| `Sync` | 디렉터리 읽기 실패 | `error` | - |
| `Sync` | 파일 stat 실패 | `error` | - |
| `Sync` | 동기화 완료 | `info` | `notify` |
| `Convert` | 변환 완료 | `info` | Watcher에서만 `notify` |
| `Convert` | 스킵 (미지원) | `info` (core) | - |
| `Convert` | 스킵 (최신) | `info` (core) | - |
| `Convert` | 변환 실패 | `error` | Watcher에서만 `notify` |

### 로깅 위치

- **Core** (`conversion-pipeline.ts`): `Skipped (unsupported)`, `Skipped (up-to-date)` — raw `console.log`
- **Plugin** (`main.ts`): 나머지 전부 — `createLogger()` 사용

---

### Task 1: createLogger 팩토리 함수 생성

**Files:**
- Create: `packages/obsidian-plugin/src/logger.ts`
- Test: `packages/obsidian-plugin/tests/logger.test.ts`

**Step 1: 실패하는 테스트 작성**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../src/logger.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

import { Notice } from 'obsidian';

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('info는 [Petrify:Namespace] 접두사로 console.log를 호출한다', () => {
    const log = createLogger('Watcher');
    log.info('File detected: test.note');
    expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Watcher] File detected: test.note');
  });

  it('error는 [Petrify:Namespace] 접두사로 console.error를 호출한다', () => {
    const log = createLogger('Sync');
    log.error('Directory unreadable: /tmp');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Petrify:Sync] Directory unreadable: /tmp');
  });

  it('error는 에러 객체를 두 번째 인자로 전달한다', () => {
    const log = createLogger('Convert');
    const err = new Error('fail');
    log.error('Conversion failed: test.note', err);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Petrify:Convert] Conversion failed: test.note', err);
  });

  it('notify는 Petrify: 접두사로 Notice를 생성한다', () => {
    const log = createLogger('Watcher');
    log.notify('Converted: test.note');
    expect(Notice).toHaveBeenCalledWith('Petrify: Converted: test.note', undefined);
  });

  it('notify는 timeout을 전달한다', () => {
    const log = createLogger('Sync');
    log.notify('Sync complete: 3 converted, 0 failed', 5000);
    expect(Notice).toHaveBeenCalledWith('Petrify: Sync complete: 3 converted, 0 failed', 5000);
  });
});
```

**Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test -- --run packages/obsidian-plugin/tests/logger.test.ts`
Expected: FAIL — `createLogger` 모듈 없음

**Step 3: 최소 구현**

```typescript
import { Notice } from 'obsidian';

type Namespace = 'Watcher' | 'Sync' | 'Convert';

export function createLogger(namespace: Namespace) {
  const prefix = `[Petrify:${namespace}]`;
  return {
    info: (msg: string) => console.log(`${prefix} ${msg}`),
    error: (msg: string, err?: unknown) =>
      err ? console.error(`${prefix} ${msg}`, err) : console.error(`${prefix} ${msg}`),
    notify: (msg: string, timeout?: number) => new Notice(`Petrify: ${msg}`, timeout),
  };
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm test -- --run packages/obsidian-plugin/tests/logger.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/logger.ts packages/obsidian-plugin/tests/logger.test.ts
git commit -m "feat: createLogger 팩토리 함수 추가 (네임스페이스 기반 로깅)"
```

---

### Task 2: ConversionPipeline에 console 로깅 추가

**Files:**
- Modify: `packages/core/src/conversion-pipeline.ts:28-44`
- Modify: `packages/core/tests/conversion-pipeline.test.ts`

**Step 1: 실패하는 테스트 작성**

`conversion-pipeline.test.ts`에 아래 테스트를 추가한다:

```typescript
it('지원하지 않는 확장자면 스킵 로그를 출력한다', async () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const pipeline = new ConversionPipeline(
    [parser], ocr, conversionState, { confidenceThreshold: 50 }
  );
  const event = createEvent({ extension: '.txt', name: 'file.txt' });

  await pipeline.handleFileChange(event);

  expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Convert] Skipped (unsupported): file.txt');
  consoleSpy.mockRestore();
});

it('mtime이 같거나 이전이면 최신 스킵 로그를 출력한다', async () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  conversionState = {
    getLastConvertedMtime: vi.fn().mockResolvedValue(1700000000000),
  };
  const pipeline = new ConversionPipeline(
    [parser], ocr, conversionState, { confidenceThreshold: 50 }
  );
  const event = createEvent({ mtime: 1700000000000 });

  await pipeline.handleFileChange(event);

  expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Convert] Skipped (up-to-date): file.note');
  consoleSpy.mockRestore();
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm test -- --run packages/core/tests/conversion-pipeline.test.ts`
Expected: FAIL — console.log가 호출되지 않음

**Step 3: ConversionPipeline에 로깅 추가**

`handleFileChange` 메서드를 수정한다:

```typescript
async handleFileChange(event: FileChangeEvent): Promise<string | null> {
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

  if (this.ocr) {
    return convertToMdWithOcr(data, parser, this.ocr, {
      ocrConfidenceThreshold: this.options.confidenceThreshold,
    });
  }

  return convertToMd(data, parser);
}
```

**Step 4: 전체 테스트 통과 확인**

Run: `pnpm test -- --run packages/core/tests/conversion-pipeline.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/core/src/conversion-pipeline.ts packages/core/tests/conversion-pipeline.test.ts
git commit -m "feat: ConversionPipeline에 스킵 사유 console 로깅 추가"
```

---

### Task 3: Watcher 핸들러 로깅 리팩토링

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:1-14` (import 추가)
- Modify: `packages/obsidian-plugin/src/main.ts:97-134` (`startWatchers`)
- Modify: `packages/obsidian-plugin/src/main.ts:136-143` (`processFile`)

**Step 1: import 추가 및 로거 인스턴스 생성**

`main.ts` 상단에 import 추가:

```typescript
import { createLogger } from './logger.js';
```

클래스 필드에 로거 추가:

```typescript
private readonly watcherLog = createLogger('Watcher');
private readonly convertLog = createLogger('Convert');
private readonly syncLog = createLogger('Sync');
```

**Step 2: processFile에 변환 완료 로깅 추가**

```typescript
private async processFile(event: FileChangeEvent, outputDir: string): Promise<boolean> {
  const result = await this.pipeline.handleFileChange(event);
  if (!result) return false;
  const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
  const outputPath = this.getOutputPath(event.name, outputDir);
  await this.saveToVault(outputPath, frontmatter + result);
  this.convertLog.info(`Converted: ${event.name}`);
  return true;
}
```

**Step 3: startWatchers의 onFileChange 핸들러 교체**

```typescript
watcher.onFileChange(async (event) => {
  this.watcherLog.info(`File detected: ${event.name}`);

  try {
    const converted = await this.processFile(event, mapping.outputDir);

    if (converted) {
      this.convertLog.notify(`Converted: ${event.name}`);
    }
  } catch (error) {
    this.convertLog.error(`Conversion failed: ${event.name}`, error);
    this.convertLog.notify(`Conversion failed: ${event.name}`);
  }
});

watcher.onError((error) => {
  this.watcherLog.error(`Watch error: ${error.message}`, error);
  this.watcherLog.notify(`Watch error: ${error.message}`);
});
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "refactor: Watcher 핸들러 로깅을 createLogger로 표준화"
```

---

### Task 4: syncAll 로깅 추가

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:176-250` (`syncAll`)

**Step 1: syncAll 메서드를 로거로 교체**

```typescript
private async syncAll(): Promise<void> {
  if (this.isSyncing) {
    this.syncLog.info('Sync already in progress');
    this.syncLog.notify('Sync already in progress');
    return;
  }

  this.isSyncing = true;
  this.syncLog.info('Sync started');
  if (this.ribbonIconEl) {
    setIcon(this.ribbonIconEl, 'loader');
  }

  let synced = 0;
  let failed = 0;

  try {
    for (const mapping of this.settings.watchMappings) {
      if (!mapping.enabled) continue;
      if (!mapping.watchDir || !mapping.outputDir) continue;

      let entries: string[];
      try {
        entries = await fs.readdir(mapping.watchDir);
      } catch {
        this.syncLog.error(`Directory unreadable: ${mapping.watchDir}`);
        failed++;
        continue;
      }

      for (const entry of entries) {
        const ext = path.extname(entry).toLowerCase();
        if (ext !== '.note') continue;

        const filePath = path.join(mapping.watchDir, entry);
        let stat: { mtimeMs: number };
        try {
          stat = await fs.stat(filePath);
        } catch {
          this.syncLog.error(`File stat failed: ${entry}`);
          failed++;
          continue;
        }

        const event: FileChangeEvent = {
          id: filePath,
          name: entry,
          extension: ext,
          mtime: stat.mtimeMs,
          readData: () => fs.readFile(filePath).then((buf) => buf.buffer as ArrayBuffer),
        };

        try {
          const converted = await this.processFile(event, mapping.outputDir);
          if (converted) {
            synced++;
          }
        } catch (error) {
          this.convertLog.error(`Conversion failed: ${entry}`, error);
          failed++;
        }
      }
    }
  } finally {
    this.isSyncing = false;
    if (this.ribbonIconEl) {
      setIcon(this.ribbonIconEl, 'refresh-cw');
    }
  }

  const summary = `Sync complete: ${synced} converted, ${failed} failed`;
  this.syncLog.info(summary);
  this.syncLog.notify(summary);
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat: syncAll에 표준화된 로깅 추가"
```

---

### Task 5: 전체 테스트 통과 확인 및 최종 빌드

**Step 1: 전체 테스트**

Run: `pnpm test`
Expected: 전체 PASS

**Step 2: 플러그인 빌드**

Run: `pnpm --filter @petrify/core build && pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 3: 기존 로깅 설계 문서 정리 커밋**

이전 `docs/plans/2026-02-05-plugin-logging.md`는 이 문서로 대체되었으므로 삭제한다.

```bash
git rm docs/plans/2026-02-05-plugin-logging.md
git add docs/plans/2026-02-05-logging-standardization.md
git commit -m "docs: 로깅 표준화 설계 문서 추가, 이전 로깅 문서 삭제"
```
