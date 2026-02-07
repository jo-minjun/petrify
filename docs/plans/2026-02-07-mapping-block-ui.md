# Mapping Block UI Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Watch Sources 매핑 블록의 레이아웃을 개선하여 UX 명확성을 높인다.

**Architecture:** `settings-tab.ts`의 `displayLocalWatchSection`과 `displayGoogleDriveSection` 두 메서드에서 매핑 블록 렌더링 코드를 수정한다. 데이터 모델 변경 없음, 순수 UI 레이아웃 변경.

**Tech Stack:** Obsidian Setting API (addToggle, addButton, setName)

---

## 변경 요약

**Before:**
```
[Local File Watch  🔘]         ← 섹션 토글
┌──────────────────────────┐
│ Watch directory  [input]  │
│ Output directory [input]  │
│ Parser           [dropdown]│
│ [🔘 toggle] [Remove]     │  ← 의미 불명확한 하단 행
└──────────────────────────┘
[Add mapping]               ← 블록 밖, 어색한 위치
```

**After:**
```
[Local File Watch  🔘]         ← 섹션 토글
[Add mapping]                  ← 매핑 블록들 위
┌──────────────────────────┐
│ Mapping #1  [🔘] [Remove]│  ← 블록 헤더 (이름 + Enabled 토글 + Remove)
│ Watch directory  [input]  │
│ Output directory [input]  │
│ Parser           [dropdown]│
└──────────────────────────┘
```

---

### Task 1: Local Watch — 블록 헤더 + Add mapping 위치 변경

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts:88-167`

**Step 1: Add mapping 버튼을 매핑 루프 위로 이동**

`displayLocalWatchSection` 메서드에서 `if (!settings.localWatch.enabled) return;` 직후,
매핑 forEach 루프 직전에 Add mapping 버튼을 배치한다.

기존 forEach 루프 아래의 Add mapping Setting은 삭제한다.

```typescript
if (!settings.localWatch.enabled) return;

new Setting(containerEl).addButton((btn) =>
  btn.setButtonText('Add mapping').onClick(async () => {
    settings.localWatch.mappings.push({
      watchDir: '',
      outputDir: '',
      enabled: false,
      parserId: ParserId.Viwoods,
    });
    await this.callbacks.saveSettings(settings);
    this.display();
  }),
);

settings.localWatch.mappings.forEach((mapping, index) => {
  // ...
});
// (기존 하단 Add mapping Setting 삭제)
```

**Step 2: 블록 하단의 토글+Remove 행을 블록 헤더로 이동**

각 매핑 블록의 첫 번째 Setting을 `Mapping #N` 이름 + Enabled 토글 + Remove 버튼으로 변경한다.
기존 하단의 이름 없는 토글+Remove Setting은 삭제한다.

```typescript
settings.localWatch.mappings.forEach((mapping, index) => {
  const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });
  mappingContainer.style.border = '1px solid var(--background-modifier-border)';
  mappingContainer.style.borderRadius = '8px';
  mappingContainer.style.padding = '8px 12px';
  mappingContainer.style.marginBottom = '12px';

  new Setting(mappingContainer)
    .setName(`Mapping #${index + 1}`)
    .addToggle((toggle) =>
      toggle.setValue(mapping.enabled).onChange(async (value) => {
        settings.localWatch.mappings[index].enabled = value;
        await this.callbacks.saveSettings(settings);
      }),
    )
    .addButton((btn) =>
      btn
        .setButtonText('Remove')
        .setWarning()
        .onClick(async () => {
          settings.localWatch.mappings.splice(index, 1);
          await this.callbacks.saveSettings(settings);
          this.display();
        }),
    );

  new Setting(mappingContainer).setName('Watch directory').addText((text) =>
    text
      .setPlaceholder('/path/to/watch')
      .setValue(mapping.watchDir)
      .onChange(async (value) => {
        settings.localWatch.mappings[index].watchDir = value;
        await this.callbacks.saveDataOnly(settings);
      }),
  );

  new Setting(mappingContainer).setName('Output directory').addText((text) =>
    text
      .setPlaceholder('Handwritings/')
      .setValue(mapping.outputDir)
      .onChange(async (value) => {
        settings.localWatch.mappings[index].outputDir = value;
        await this.callbacks.saveDataOnly(settings);
      }),
  );

  new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
    for (const id of Object.values(ParserId)) {
      dropdown.addOption(id, id);
    }
    dropdown.setValue(mapping.parserId || ParserId.Viwoods);
    dropdown.onChange(async (value) => {
      settings.localWatch.mappings[index].parserId = value;
      await this.callbacks.saveSettings(settings);
    });
  });
});
```

**Step 3: typecheck 확인**

Run: `pnpm typecheck`
Expected: 전체 통과

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "refactor(settings-tab): Local Watch 매핑 블록 헤더 + Add mapping 위치 개선"
```

---

### Task 2: Google Drive — 동일 패턴 적용

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts:242-320`

**Step 1: Add mapping 버튼을 매핑 루프 위로 이동**

`displayGoogleDriveSection` 메서드에서 Auto Polling 관련 설정 직후,
매핑 forEach 루프 직전에 Add mapping 버튼을 배치한다.

기존 forEach 루프 아래의 Add mapping Setting은 삭제한다.

```typescript
// (Auto Polling / Poll Interval 설정 이후)

new Setting(containerEl).addButton((btn) =>
  btn.setButtonText('Add mapping').onClick(async () => {
    settings.googleDrive.mappings.push({
      folderId: '',
      folderName: '',
      outputDir: '',
      enabled: false,
      parserId: ParserId.Viwoods,
    });
    await this.callbacks.saveSettings(settings);
    this.display();
  }),
);

settings.googleDrive.mappings.forEach((mapping, index) => {
  // ...
});
// (기존 하단 Add mapping Setting 삭제)
```

**Step 2: 블록 하단의 토글+Remove 행을 블록 헤더로 이동**

Local Watch와 동일 패턴. `Mapping #N` 헤더 + Enabled 토글 + Remove 버튼을 첫 번째 Setting으로.
기존 하단 토글+Remove 삭제.

```typescript
settings.googleDrive.mappings.forEach((mapping, index) => {
  const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });
  mappingContainer.style.border = '1px solid var(--background-modifier-border)';
  mappingContainer.style.borderRadius = '8px';
  mappingContainer.style.padding = '8px 12px';
  mappingContainer.style.marginBottom = '12px';

  new Setting(mappingContainer)
    .setName(`Mapping #${index + 1}`)
    .addToggle((toggle) =>
      toggle.setValue(mapping.enabled).onChange(async (value) => {
        settings.googleDrive.mappings[index].enabled = value;
        await this.callbacks.saveSettings(settings);
      }),
    )
    .addButton((btn) =>
      btn
        .setButtonText('Remove')
        .setWarning()
        .onClick(async () => {
          settings.googleDrive.mappings.splice(index, 1);
          await this.callbacks.saveSettings(settings);
          this.display();
        }),
    );

  new Setting(mappingContainer)
    .setName('Folder')
    .setDesc(mapping.folderName || 'No folder selected')
    .addButton((btn) =>
      btn.setButtonText('Browse').onClick(async () => {
        const client = await this.callbacks.getGoogleDriveClient();
        if (!client) {
          new Notice('Configure Client ID and Secret first');
          return;
        }
        new FolderBrowseModal(this.app, client, (result) => {
          settings.googleDrive.mappings[index].folderId = result.folderId;
          settings.googleDrive.mappings[index].folderName = result.folderName;
          this.callbacks.saveSettings(settings);
          this.display();
        }).open();
      }),
    );

  new Setting(mappingContainer).setName('Output directory').addText((text) =>
    text
      .setPlaceholder('Handwritings/')
      .setValue(mapping.outputDir)
      .onChange(async (value) => {
        settings.googleDrive.mappings[index].outputDir = value;
        await this.callbacks.saveDataOnly(settings);
      }),
  );

  new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
    for (const id of Object.values(ParserId)) {
      dropdown.addOption(id, id);
    }
    dropdown.setValue(mapping.parserId || ParserId.Viwoods);
    dropdown.onChange(async (value) => {
      settings.googleDrive.mappings[index].parserId = value;
      await this.callbacks.saveSettings(settings);
    });
  });
});
```

**Step 3: 전체 검증**

Run: `pnpm typecheck && pnpm test && pnpm biome check`
Expected: 전체 통과

**Step 4: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "refactor(settings-tab): Google Drive 매핑 블록 헤더 + Add mapping 위치 개선"
```
