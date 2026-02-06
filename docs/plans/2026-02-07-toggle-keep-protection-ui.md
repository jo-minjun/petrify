# Toggle Keep Protection UI 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Obsidian 플러그인에서 파일 우클릭 메뉴와 Command Palette로 petrify 결과 파일의 `keep` 속성을 토글할 수 있게 한다.

**Architecture:** `frontmatter.ts`에 파일 내용의 frontmatter keep 값을 토글하는 순수 함수를 추가하고, `main.ts`에서 Obsidian의 `file-menu` 이벤트와 `addCommand`를 통해 이 함수를 호출한다. 기존 `parseFrontmatter`/`createFrontmatter` 유틸을 활용하되, 파일 전체를 재생성하지 않고 frontmatter 부분만 교체한다.

**Tech Stack:** TypeScript, Obsidian API (`Plugin.addCommand`, `workspace.on('file-menu')`, `vault.read`, `vault.modify`, `Notice`), Vitest

---

### Task 1: `updateKeepInContent` 순수 함수 — 테스트 작성

**Files:**
- Test: `packages/obsidian-plugin/tests/utils/frontmatter.test.ts`

**Step 1: 테스트 추가**

`frontmatter.test.ts`의 최상위 `describe` 블록 안에 새 `describe('updateKeepInContent')` 블록을 추가한다.

```typescript
describe('updateKeepInContent', () => {
  it('keep이 없는 frontmatter에 keep: true를 추가한다', () => {
    const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
excalidraw-plugin: parsed
---

# Content`;

    const result = updateKeepInContent(content, true);

    expect(result).toContain('keep: true');
    expect(result).toContain('# Content');
    expect(result).toContain('source: /path/to/file.note');
  });

  it('keep: true를 제거한다', () => {
    const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
  keep: true
excalidraw-plugin: parsed
---

# Content`;

    const result = updateKeepInContent(content, false);

    expect(result).not.toContain('keep');
    expect(result).toContain('# Content');
    expect(result).toContain('source: /path/to/file.note');
  });

  it('keep: false를 keep: true로 변경한다', () => {
    const content = `---
petrify:
  source: null
  mtime: null
  keep: false
excalidraw-plugin: parsed
---

content`;

    const result = updateKeepInContent(content, true);

    expect(result).toContain('keep: true');
    expect(result).not.toContain('keep: false');
  });

  it('이미 keep: true인 상태에서 true를 설정하면 변경 없음', () => {
    const content = `---
petrify:
  source: null
  mtime: null
  keep: true
excalidraw-plugin: parsed
---

content`;

    const result = updateKeepInContent(content, true);

    expect(result).toBe(content);
  });

  it('frontmatter가 없는 파일은 변경 없이 그대로 반환한다', () => {
    const content = '# Just a markdown file';

    const result = updateKeepInContent(content, true);

    expect(result).toBe(content);
  });

  it('petrify 메타데이터가 없는 frontmatter는 변경 없이 반환한다', () => {
    const content = `---
excalidraw-plugin: parsed
---

# Content`;

    const result = updateKeepInContent(content, true);

    expect(result).toBe(content);
  });
});
```

import 문에 `updateKeepInContent`를 추가한다:

```typescript
import { createFrontmatter, parseFrontmatter, updateKeepInContent } from '../../src/utils/frontmatter.js';
```

**Step 2: 테스트 실패 확인**

Run: `pnpm vitest run packages/obsidian-plugin/tests/utils/frontmatter.test.ts`
Expected: FAIL — `updateKeepInContent` is not exported

**Step 3: 커밋하지 않음 (Task 2에서 구현 후 함께 커밋)**

---

### Task 2: `updateKeepInContent` 순수 함수 — 구현

**Files:**
- Modify: `packages/obsidian-plugin/src/utils/frontmatter.ts`

**Step 1: 함수 구현**

`frontmatter.ts` 파일 끝에 다음 함수를 추가한다:

```typescript
export function updateKeepInContent(content: string, keep: boolean): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return content;

  const meta = parseFrontmatter(content);
  if (!meta) return content;

  const newFrontmatter = createFrontmatter({ ...meta, keep: keep || undefined });
  return content.replace(/^---\n[\s\S]*?\n---\n\n/, newFrontmatter);
}
```

전략: `parseFrontmatter`로 현재 값을 읽고, `createFrontmatter`로 새 frontmatter를 만든 뒤, 원본 content의 frontmatter 부분만 교체한다. `keep`이 `false`이면 `undefined`로 변환해서 `createFrontmatter`가 keep 줄을 생략하게 한다.

**Step 2: 테스트 통과 확인**

Run: `pnpm vitest run packages/obsidian-plugin/tests/utils/frontmatter.test.ts`
Expected: ALL PASS

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/utils/frontmatter.ts packages/obsidian-plugin/tests/utils/frontmatter.test.ts
git commit -m "feat(obsidian-plugin): frontmatter keep 값을 토글하는 updateKeepInContent 함수 추가"
```

---

### Task 3: Command Palette 커맨드 등록

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: import 추가**

`main.ts` 상단의 obsidian import에 `Notice`, `TFile`, `Menu`를 추가한다:

```typescript
import { Notice, Plugin, setIcon, TFile } from 'obsidian';
```

`updateKeepInContent`를 import한다:

```typescript
import { parseFrontmatter, updateKeepInContent } from './utils/frontmatter.js';
```

**Step 2: `toggleKeep` private 메서드 추가**

`PetrifyPlugin` 클래스 내부에 다음 메서드를 추가한다 (`handleDeletedSource` 메서드 아래):

```typescript
private async toggleKeep(file: TFile): Promise<void> {
  const content = await this.app.vault.read(file);
  const meta = parseFrontmatter(content);
  if (!meta) {
    new Notice('Petrify: Not a petrify-generated file');
    return;
  }

  const newKeep = !meta.keep;
  const updated = updateKeepInContent(content, newKeep);
  await this.app.vault.modify(file, updated);

  const status = newKeep ? 'protected' : 'unprotected';
  new Notice(`Petrify: File ${status}`);
}
```

**Step 3: `isPetrifyFile` private 메서드 추가**

```typescript
private isPetrifyFile(file: TFile): boolean {
  return file.path.endsWith(this.generator.extension);
}
```

**Step 4: `addCommand` 등록**

`onload()` 메서드에서 기존 `petrify-sync` 커맨드 등록 블록 아래에 추가한다:

```typescript
this.addCommand({
  id: 'toggle-keep-protection',
  name: 'Toggle keep protection',
  checkCallback: (checking: boolean) => {
    const file = this.app.workspace.getActiveFile();
    if (!file || !this.isPetrifyFile(file)) return false;
    if (!checking) {
      this.toggleKeep(file);
    }
    return true;
  },
});
```

`checkCallback`을 사용하면 petrify 파일이 열려있을 때만 커맨드가 커맨드 팔레트에 표시된다.

**Step 5: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공 (에러 없음)

**Step 6: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat(obsidian-plugin): keep 토글 Command Palette 커맨드 추가"
```

---

### Task 4: File Context Menu 등록

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: `file-menu` 이벤트 등록**

`onload()` 메서드에서 커맨드 등록 블록 아래, `addSettingTab` 이전에 추가한다:

```typescript
this.registerEvent(
  this.app.workspace.on('file-menu', (menu, file) => {
    if (!(file instanceof TFile) || !this.isPetrifyFile(file)) return;

    menu.addItem((item) => {
      item
        .setTitle('Petrify: Toggle keep protection')
        .setIcon('shield')
        .onClick(() => this.toggleKeep(file));
    });
  }),
);
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat(obsidian-plugin): keep 토글 파일 우클릭 메뉴 추가"
```

---

### Task 5: 전체 테스트 및 빌드 검증

**Files:** (변경 없음 — 검증만)

**Step 1: 전체 테스트 실행**

Run: `pnpm vitest run`
Expected: ALL PASS

**Step 2: 플러그인 빌드**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 3: 최종 커밋 (필요한 경우)**

lint 수정이 필요한 경우에만 커밋한다.
