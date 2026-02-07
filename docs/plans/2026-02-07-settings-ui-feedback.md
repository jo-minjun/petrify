# Settings UI 피드백 반영 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 설정 UI의 UX 피드백 5건을 반영하여 사용성 개선

**Architecture:** `settings-tab.ts`의 기존 OCR pending 패턴을 Watch Sources에도 확장하고, Google Drive 하위 설정의 시각적 계층 구조를 개선하며, Language Hints를 드롭다운+태그 UI로 교체한다. 모든 Save 버튼은 변경사항 없거나 invalid 값이면 disabled.

**Tech Stack:** Obsidian Plugin API (Setting, PluginSettingTab), TypeScript

---

### Task 1: Watch Sources pending 상태 인프라 추가

Watch Sources 섹션에 OCR과 동일한 pending 패턴을 적용한다. 모든 Watch Sources 필드(토글, 텍스트, 드롭다운)를 pending 상태로 관리하고, Save 버튼 클릭 시에만 실제 저장한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: pending 필드 추가**

클래스에 Watch Sources용 pending 상태 필드를 추가한다. 기존 OCR pending 필드 아래에 추가:

```typescript
// 기존 OCR pending 필드 아래에 추가
private pendingLocalWatch: LocalWatchSettings = structuredClone(DEFAULT_SETTINGS.localWatch);
private pendingGoogleDrive: GoogleDriveSettings = structuredClone(DEFAULT_SETTINGS.googleDrive);
private hasPendingWatchEdits = false;
```

import에 `LocalWatchSettings`, `GoogleDriveSettings` 추가:

```typescript
import {
  DEFAULT_SETTINGS,
  LANGUAGE_HINT_OPTIONS,
  type GoogleDriveSettings,
  type LanguageHint,
  type LocalWatchSettings,
  type OcrProvider,
  type OutputFormat,
  type PetrifySettings,
} from './settings.js';
```

**Step 2: displayWatchSourcesSettings에서 pending 초기화**

`displayWatchSourcesSettings` 메서드 시작 부분에서 pending 상태를 초기화한다:

```typescript
private displayWatchSourcesSettings(containerEl: HTMLElement): void {
  containerEl.createEl('h2', { text: 'Watch Sources' });

  const settings = this.callbacks.getSettings();

  if (!this.hasPendingWatchEdits) {
    this.pendingLocalWatch = structuredClone(settings.localWatch);
    this.pendingGoogleDrive = structuredClone(settings.googleDrive);
    this.hasPendingWatchEdits = true;
  }

  this.displayLocalWatchSection(containerEl);
  this.displayGoogleDriveSection(containerEl);
  this.displayWatchSourcesSaveButton(containerEl);
}
```

**Step 3: displayLocalWatchSection을 pending 기반으로 변환**

`settings` 파라미터를 제거하고 `this.pendingLocalWatch`를 직접 사용하도록 변환한다. 모든 `await this.callbacks.saveSettings(settings)` / `await this.callbacks.saveDataOnly(settings)` 호출을 제거하고, pending 상태만 변경 + `this.display()` 호출로 교체한다:

```typescript
private displayLocalWatchSection(containerEl: HTMLElement): void {
  new Setting(containerEl)
    .setName('Local File Watch')
    .setDesc('Watch local directories for file changes')
    .addToggle((toggle) =>
      toggle.setValue(this.pendingLocalWatch.enabled).onChange((value) => {
        this.pendingLocalWatch.enabled = value;
        this.display();
      }),
    );

  if (!this.pendingLocalWatch.enabled) return;

  new Setting(containerEl).addButton((btn) =>
    btn.setButtonText('Add mapping').onClick(() => {
      this.pendingLocalWatch.mappings.push({
        watchDir: '',
        outputDir: '',
        enabled: false,
        parserId: ParserId.Viwoods,
      });
      this.display();
    }),
  );

  this.pendingLocalWatch.mappings.forEach((mapping, index) => {
    const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });
    mappingContainer.style.border = '1px solid var(--background-modifier-border)';
    mappingContainer.style.borderRadius = '8px';
    mappingContainer.style.padding = '8px 12px';
    mappingContainer.style.marginBottom = '12px';

    new Setting(mappingContainer)
      .setName(`Mapping #${index + 1}`)
      .addToggle((toggle) =>
        toggle.setValue(mapping.enabled).onChange((value) => {
          this.pendingLocalWatch.mappings[index].enabled = value;
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText('Remove')
          .setWarning()
          .onClick(() => {
            this.pendingLocalWatch.mappings.splice(index, 1);
            this.display();
          }),
      );

    new Setting(mappingContainer).setName('Watch directory').addText((text) =>
      text
        .setPlaceholder('/path/to/watch')
        .setValue(mapping.watchDir)
        .onChange((value) => {
          this.pendingLocalWatch.mappings[index].watchDir = value;
        }),
    );

    new Setting(mappingContainer).setName('Output directory').addText((text) =>
      text
        .setPlaceholder('Handwritings/')
        .setValue(mapping.outputDir)
        .onChange((value) => {
          this.pendingLocalWatch.mappings[index].outputDir = value;
        }),
    );

    new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
      for (const id of Object.values(ParserId)) {
        dropdown.addOption(id, id);
      }
      dropdown.setValue(mapping.parserId || ParserId.Viwoods);
      dropdown.onChange((value) => {
        this.pendingLocalWatch.mappings[index].parserId = value;
      });
    });
  });
}
```

**Step 4: displayGoogleDriveSection을 pending 기반으로 변환 + border 컨테이너 적용**

`settings` 파라미터를 제거하고 `this.pendingGoogleDrive`를 사용하도록 변환한다. Google Drive 토글 아래 하위 설정 전체를 border 컨테이너로 감싼다:

```typescript
private displayGoogleDriveSection(containerEl: HTMLElement): void {
  new Setting(containerEl)
    .setName('Google Drive API')
    .setDesc('Sync and convert files from Google Drive')
    .addToggle((toggle) =>
      toggle.setValue(this.pendingGoogleDrive.enabled).onChange((value) => {
        this.pendingGoogleDrive.enabled = value;
        this.display();
      }),
    );

  if (!this.pendingGoogleDrive.enabled) return;

  const driveContainer = containerEl.createDiv({ cls: 'petrify-drive-settings' });
  driveContainer.style.border = '1px solid var(--background-modifier-border)';
  driveContainer.style.borderRadius = '8px';
  driveContainer.style.padding = '8px 12px';
  driveContainer.style.marginBottom = '12px';
  driveContainer.style.marginLeft = '16px';

  new Setting(driveContainer)
    .setName('Client ID')
    .setDesc('OAuth2 Client ID from Google Cloud Console')
    .addText((text) =>
      text
        .setPlaceholder('Enter Client ID')
        .setValue(this.pendingGoogleDrive.clientId)
        .onChange((value) => {
          this.pendingGoogleDrive.clientId = value;
        }),
    );

  new Setting(driveContainer)
    .setName('Client Secret')
    .setDesc('OAuth2 Client Secret from Google Cloud Console')
    .addText((text) => {
      text.inputEl.type = 'password';
      text
        .setPlaceholder('Enter Client Secret')
        .setValue(this.pendingGoogleDrive.clientSecret)
        .onChange((value) => {
          this.pendingGoogleDrive.clientSecret = value;
        });
    });

  new Setting(driveContainer)
    .setName('Auto Polling')
    .setDesc('Automatically poll for changes in Google Drive')
    .addToggle((toggle) =>
      toggle.setValue(this.pendingGoogleDrive.autoPolling).onChange((value) => {
        this.pendingGoogleDrive.autoPolling = value;
        this.display();
      }),
    );

  if (this.pendingGoogleDrive.autoPolling) {
    new Setting(driveContainer)
      .setName('Poll Interval')
      .setDesc('Minutes between polling (1-60)')
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.max = '60';
        text.inputEl.step = '1';
        text
          .setValue(String(this.pendingGoogleDrive.pollIntervalMinutes))
          .onChange((value) => {
            const num = Number(value);
            const valid = !Number.isNaN(num) && num >= 1 && num <= 60;
            text.inputEl.style.borderColor = valid ? '' : 'var(--text-error)';
            if (valid) {
              this.pendingGoogleDrive.pollIntervalMinutes = num;
            }
          });
      });
  }

  new Setting(driveContainer).addButton((btn) =>
    btn.setButtonText('Add mapping').onClick(() => {
      this.pendingGoogleDrive.mappings.push({
        folderId: '',
        folderName: '',
        outputDir: '',
        enabled: false,
        parserId: ParserId.Viwoods,
      });
      this.display();
    }),
  );

  this.pendingGoogleDrive.mappings.forEach((mapping, index) => {
    const mappingContainer = driveContainer.createDiv({ cls: 'petrify-mapping' });
    mappingContainer.style.border = '1px solid var(--background-modifier-border)';
    mappingContainer.style.borderRadius = '8px';
    mappingContainer.style.padding = '8px 12px';
    mappingContainer.style.marginBottom = '12px';

    new Setting(mappingContainer)
      .setName(`Mapping #${index + 1}`)
      .addToggle((toggle) =>
        toggle.setValue(mapping.enabled).onChange((value) => {
          this.pendingGoogleDrive.mappings[index].enabled = value;
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText('Remove')
          .setWarning()
          .onClick(() => {
            this.pendingGoogleDrive.mappings.splice(index, 1);
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
            this.pendingGoogleDrive.mappings[index].folderId = result.folderId;
            this.pendingGoogleDrive.mappings[index].folderName = result.folderName;
            this.display();
          }).open();
        }),
      );

    new Setting(mappingContainer).setName('Output directory').addText((text) =>
      text
        .setPlaceholder('Handwritings/')
        .setValue(mapping.outputDir)
        .onChange((value) => {
          this.pendingGoogleDrive.mappings[index].outputDir = value;
        }),
    );

    new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
      for (const id of Object.values(ParserId)) {
        dropdown.addOption(id, id);
      }
      dropdown.setValue(mapping.parserId || ParserId.Viwoods);
      dropdown.onChange((value) => {
        this.pendingGoogleDrive.mappings[index].parserId = value;
      });
    });
  });
}
```

**Step 5: Watch Sources Save 버튼 추가**

`displayWatchSourcesSaveButton` 메서드를 추가한다. 변경사항이 없거나 invalid 값이면 disabled:

```typescript
private displayWatchSourcesSaveButton(containerEl: HTMLElement): void {
  const settings = this.callbacks.getSettings();

  const hasChanges = JSON.stringify({
    localWatch: this.pendingLocalWatch,
    googleDrive: this.pendingGoogleDrive,
  }) !== JSON.stringify({
    localWatch: settings.localWatch,
    googleDrive: settings.googleDrive,
  });

  const isValid = this.isWatchSourcesValid();

  new Setting(containerEl).addButton((btn) => {
    btn
      .setButtonText('Save')
      .setCta()
      .onClick(async () => {
        settings.localWatch = structuredClone(this.pendingLocalWatch);
        settings.googleDrive = structuredClone(this.pendingGoogleDrive);
        await this.callbacks.saveSettings(settings);
        this.hasPendingWatchEdits = false;
        this.display();
      });

    const canSave = hasChanges && isValid;
    btn.buttonEl.disabled = !canSave;
    btn.buttonEl.toggleClass('is-disabled', !canSave);
  });
}

private isWatchSourcesValid(): boolean {
  if (this.pendingGoogleDrive.enabled) {
    if (this.pendingGoogleDrive.autoPolling) {
      const interval = this.pendingGoogleDrive.pollIntervalMinutes;
      if (Number.isNaN(interval) || interval < 1 || interval > 60) return false;
    }
  }
  return true;
}
```

**Step 6: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 7: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "feat(settings-tab): Watch Sources에 pending 패턴 + Save 버튼 추가

- 모든 Watch Sources 필드를 pending 상태로 관리
- Save 버튼으로 일괄 저장 (변경 없거나 invalid 시 disabled)
- Google Drive 하위 설정을 border 컨테이너로 감싸 계층 구조 표현
- Local File Watch / Google Drive API에 설명 추가"
```

---

### Task 2: OCR Settings Save 버튼 개선

OCR Save 버튼 텍스트를 "Save"로 변경하고, 변경사항 없을 때 disabled 처리를 추가한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: OCR Save 버튼 개선**

`displayOcrSettings` 메서드에서:
1. 버튼 텍스트를 `Save OCR Settings` → `Save`로 변경
2. 변경사항 감지 로직 추가 (pending vs saved 비교)
3. `updateSaveButton`에 변경사항 없음 조건 추가

```typescript
private displayOcrSettings(containerEl: HTMLElement): void {
  containerEl.createEl('h2', { text: 'OCR Settings' });

  const settings = this.callbacks.getSettings();

  if (!this.hasPendingOcrEdits) {
    this.pendingProvider = settings.ocr.provider;
    this.pendingApiKey = settings.ocr.googleVision.apiKey;
    this.pendingLanguageHints = [...settings.ocr.googleVision.languageHints];
    this.pendingConfidenceThreshold = settings.ocr.confidenceThreshold;
    this.hasPendingOcrEdits = true;
  }

  let saveButton: HTMLButtonElement | null = null;

  const updateSaveButton = () => {
    if (!saveButton) return;
    const isGoogleVision = this.pendingProvider === 'google-vision';
    const hasApiKey = this.pendingApiKey.trim().length > 0;
    const isValid = !isGoogleVision || hasApiKey;

    const hasChanges =
      this.pendingProvider !== settings.ocr.provider ||
      this.pendingApiKey !== settings.ocr.googleVision.apiKey ||
      JSON.stringify(this.pendingLanguageHints) !==
        JSON.stringify(settings.ocr.googleVision.languageHints) ||
      this.pendingConfidenceThreshold !== settings.ocr.confidenceThreshold;

    const canSave = isValid && hasChanges;
    saveButton.disabled = !canSave;
    saveButton.toggleClass('is-disabled', !canSave);
  };

  // ... (Provider, API Key, Confidence Threshold 섹션은 기존과 동일)
  // Language Hints 섹션은 Task 3에서 변경

  new Setting(containerEl).addButton((btn) => {
    saveButton = btn.buttonEl;
    btn
      .setButtonText('Save')  // 변경: 'Save OCR Settings' → 'Save'
      .setCta()
      .onClick(async () => {
        settings.ocr.provider = this.pendingProvider;
        settings.ocr.googleVision.apiKey = this.pendingApiKey;
        settings.ocr.googleVision.languageHints = this.pendingLanguageHints;
        settings.ocr.confidenceThreshold = this.pendingConfidenceThreshold;
        await this.callbacks.saveSettings(settings);
        this.hasPendingOcrEdits = false;
        this.display();
      });
  });

  updateSaveButton();
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "feat(settings-tab): OCR Save 버튼 텍스트 축소 + 변경 감지 추가

- 'Save OCR Settings' → 'Save'
- 변경사항 없으면 Save 버튼 disabled"
```

---

### Task 3: Language Hints 드롭다운 + 태그 UI 구현

현재 토글 5개 나열 방식을 드롭다운으로 언어 선택 → 태그(chip)로 표시 → x 버튼으로 제거하는 구조로 변경한다.

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: Language Hints 섹션 교체**

`displayOcrSettings` 내 Language Hints 부분을 교체한다. 기존 토글 루프를 제거하고, 드롭다운 + 태그 컨테이너로 교체:

```typescript
// displayOcrSettings 내, Google Vision 조건 블록 안에서
// 기존 languageSetting + for 루프 전체를 아래로 교체:

const languageSetting = new Setting(containerEl)
  .setName('Language Hints')
  .setDesc('Preferred languages for recognition');

// 선택되지 않은 언어만 드롭다운에 표시
const unselected = LANGUAGE_HINT_OPTIONS.filter(
  (opt) => !this.pendingLanguageHints.includes(opt.value),
);

if (unselected.length > 0) {
  languageSetting.addDropdown((dropdown) => {
    dropdown.addOption('', 'Add language...');
    for (const opt of unselected) {
      dropdown.addOption(opt.value, opt.label);
    }
    dropdown.onChange((value) => {
      if (value && !this.pendingLanguageHints.includes(value as LanguageHint)) {
        this.pendingLanguageHints.push(value as LanguageHint);
        updateSaveButton();
        this.display();
      }
    });
  });
}

// 선택된 언어를 태그로 표시
if (this.pendingLanguageHints.length > 0) {
  const tagContainer = containerEl.createDiv({ cls: 'petrify-language-tags' });
  tagContainer.style.display = 'flex';
  tagContainer.style.flexWrap = 'wrap';
  tagContainer.style.gap = '4px';
  tagContainer.style.marginBottom = '12px';

  for (const hint of this.pendingLanguageHints) {
    const option = LANGUAGE_HINT_OPTIONS.find((o) => o.value === hint);
    if (!option) continue;

    const tag = tagContainer.createDiv({ cls: 'petrify-language-tag' });
    tag.style.display = 'inline-flex';
    tag.style.alignItems = 'center';
    tag.style.gap = '4px';
    tag.style.padding = '2px 8px';
    tag.style.borderRadius = '12px';
    tag.style.backgroundColor = 'var(--background-modifier-hover)';
    tag.style.fontSize = '12px';

    tag.createSpan({ text: option.label });

    const removeBtn = tag.createEl('span', { text: '×', cls: 'petrify-tag-remove' });
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.style.marginLeft = '2px';
    removeBtn.addEventListener('click', () => {
      this.pendingLanguageHints = this.pendingLanguageHints.filter((h) => h !== hint);
      updateSaveButton();
      this.display();
    });
  }
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "feat(settings-tab): Language Hints를 드롭다운 + 태그 UI로 변경

- 드롭다운으로 언어 선택 시 태그(chip)로 추가
- 각 태그에 × 버튼으로 제거
- 선택된 언어는 드롭다운에서 제외"
```

---

### Task 4: data.json 기본값 초기화

`data.json`을 `DEFAULT_SETTINGS` 값으로 초기화한다.

**Files:**
- Modify: `packages/obsidian-plugin/data.json`

**Step 1: data.json을 DEFAULT_SETTINGS 기본값으로 교체**

```json
{
  "outputFormat": "excalidraw",
  "autoSync": false,
  "localWatch": {
    "enabled": false,
    "mappings": []
  },
  "googleDrive": {
    "enabled": false,
    "clientId": "",
    "clientSecret": "",
    "autoPolling": true,
    "pollIntervalMinutes": 5,
    "mappings": []
  },
  "ocr": {
    "provider": "tesseract",
    "confidenceThreshold": 50,
    "googleVision": {
      "apiKey": "",
      "languageHints": ["ko", "en"]
    }
  }
}
```

**Step 2: 커밋**

```bash
git add packages/obsidian-plugin/data.json
git commit -m "chore: data.json 기본값으로 초기화"
```

---

### Task 5: 검증

**Step 1: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

**Step 2: 테스트**

Run: `pnpm test`
Expected: 모든 테스트 통과

**Step 3: 린트**

Run: `pnpm biome check`
Expected: 에러 없음

**Step 4: 빌드**

Run: `pnpm --filter @petrify/obsidian-plugin build`
Expected: 빌드 성공
