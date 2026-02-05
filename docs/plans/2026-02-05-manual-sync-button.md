# Manual Sync Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Obsidian 플러그인에 리본 아이콘 + 커맨드 팔레트로 수동 동기화를 트리거하는 기능 추가

**Architecture:** 기존 `ConversionPipeline.handleFileChange()`를 재사용하여 활성화된 watchMapping의 감시 디렉터리를 스캔하고, 각 파일에 대해 `FileChangeEvent`를 직접 생성하여 파이프라인에 전달한다. 리본 아이콘과 커맨드 팔레트 두 곳에서 동일한 `syncAll()` 메서드를 호출한다.

**Tech Stack:** Obsidian API (`addRibbonIcon`, `addCommand`, `Notice`, `setIcon`), Node.js `fs/promises`, `path`

---

### Task 1: syncAll() 메서드 추가

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:19` (PetrifyPlugin 클래스)

**Step 1: syncAll 메서드 작성**

`PetrifyPlugin` 클래스에 다음 필드와 메서드를 추가한다:

```typescript
// 필드 (line 23 부근, ocr 아래에 추가)
private isSyncing = false;
private ribbonIconEl: HTMLElement | null = null;
```

```typescript
// private 메서드 (restart() 아래에 추가)
private async syncAll(): Promise<void> {
  if (this.isSyncing) {
    new Notice('Sync already in progress');
    return;
  }

  this.isSyncing = true;
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
          const result = await this.pipeline.handleFileChange(event);
          if (result) {
            const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
            const outputPath = this.getOutputPath(event.name, mapping.outputDir);
            await this.saveToVault(outputPath, frontmatter + result);
            synced++;
          }
        } catch {
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

  if (synced === 0 && failed === 0) {
    new Notice('No files to sync');
  } else if (failed === 0) {
    new Notice(`Synced ${synced} file(s)`);
  } else if (synced === 0) {
    new Notice(`Sync failed: ${failed} file(s) failed`);
  } else {
    new Notice(`Synced ${synced} file(s), ${failed} failed`);
  }
}
```

**Step 2: import 추가**

`main.ts` 1행의 import에 `setIcon` 추가:

```typescript
import { Notice, Plugin, setIcon } from 'obsidian';
```

`FileChangeEvent` 타입 import 추가 (line 6 부근):

```typescript
import type { WatcherPort, FileChangeEvent } from '@petrify/core';
```

**Step 3: 빌드 확인**

Run: `pnpm build --filter @petrify/obsidian-plugin`
Expected: 빌드 성공 (syncAll은 아직 호출되지 않지만 컴파일은 통과)

**Step 4: Commit**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat: syncAll() 수동 동기화 메서드 추가"
```

---

### Task 2: 리본 아이콘 등록

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:25-46` (onload 메서드)

**Step 1: onload()에 리본 아이콘 추가**

`onload()` 메서드의 `this.addSettingTab(...)` 호출 전에 리본 아이콘 등록 코드를 추가한다:

```typescript
// initializePipeline() 호출 후, addSettingTab() 전에 추가
this.ribbonIconEl = this.addRibbonIcon('refresh-cw', 'Petrify: Sync', async () => {
  await this.syncAll();
});
```

**Step 2: 빌드 확인**

Run: `pnpm build --filter @petrify/obsidian-plugin`
Expected: 빌드 성공

**Step 3: Commit**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat: 리본 아이콘으로 수동 동기화 트리거 추가"
```

---

### Task 3: 커맨드 팔레트 등록

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:25-46` (onload 메서드)

**Step 1: onload()에 커맨드 추가**

리본 아이콘 등록 코드 바로 아래에 커맨드 등록을 추가한다:

```typescript
this.addCommand({
  id: 'petrify-sync',
  name: 'Sync',
  callback: async () => {
    await this.syncAll();
  },
});
```

**Step 2: 빌드 확인**

Run: `pnpm build --filter @petrify/obsidian-plugin`
Expected: 빌드 성공

**Step 3: Commit**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat: 커맨드 팔레트에서 수동 동기화 명령 추가"
```

---

### Task 4: 수동 검증

**Step 1: Obsidian에서 플러그인 리로드**

1. Obsidian 설정 → Community Plugins → Petrify 비활성화 후 다시 활성화
2. 왼쪽 리본에 `refresh-cw` (회전 화살표) 아이콘 확인

**Step 2: 리본 아이콘 클릭 테스트**

1. 감시 디렉터리에 .note 파일이 있는 상태에서 리본 아이콘 클릭
2. 아이콘이 잠시 로딩 아이콘으로 바뀌었다가 복원되는지 확인
3. Notice 메시지가 올바르게 표시되는지 확인

**Step 3: 커맨드 팔레트 테스트**

1. `Cmd+P` → "Petrify: Sync" 검색
2. 실행 후 동일한 동작 확인

**Step 4: 중복 실행 방지 테스트**

1. 리본 아이콘 빠르게 두 번 클릭
2. "Sync already in progress" Notice 표시 확인
