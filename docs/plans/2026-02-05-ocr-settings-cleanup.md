# OCR 설정 정리 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 미구현 OCR provider 옵션(google-vision, azure-ocr)을 제거하고, Confidence Threshold를 슬라이더에서 숫자 입력으로 변경한다.

**Architecture:** obsidian-plugin 내부 설정 인터페이스 및 UI 코드만 변경. core/adapter 패키지 변경 없음.

**Tech Stack:** TypeScript, Obsidian API (Setting.addText)

---

### Task 1: settings.ts에서 미구현 provider 타입 제거

**Files:**
- Modify: `packages/obsidian-plugin/src/settings.ts`
- Modify: `packages/obsidian-plugin/tests/settings.test.ts`

**Step 1: 테스트 먼저 수정**

`packages/obsidian-plugin/tests/settings.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings.js';

describe('PetrifySettings', () => {
  it('DEFAULT_SETTINGS는 빈 watchMappings를 가진다', () => {
    expect(DEFAULT_SETTINGS.watchMappings).toEqual([]);
  });

  it('DEFAULT_SETTINGS는 기본 OCR 설정을 가진다', () => {
    expect(DEFAULT_SETTINGS.ocr.confidenceThreshold).toBe(50);
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: FAIL — `provider` 관련 assertion 제거했으므로 테스트는 통과해야 함. 사실상 이 단계에서는 통과.

**Step 3: settings.ts 수정**

`packages/obsidian-plugin/src/settings.ts`를 다음으로 교체:
```typescript
export interface WatchMapping {
  watchDir: string;
  outputDir: string;
}

export interface OcrSettings {
  confidenceThreshold: number;
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  watchMappings: [],
  ocr: {
    confidenceThreshold: 50,
  },
};
```

삭제 대상:
- `OcrProviderConfig` 인터페이스 전체
- `OcrSettings.provider` 필드
- `OcrSettings.providerConfig` 필드
- `DEFAULT_SETTINGS.ocr.provider`
- `DEFAULT_SETTINGS.ocr.providerConfig`

**Step 4: 테스트 실행**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/settings.ts packages/obsidian-plugin/tests/settings.test.ts
git commit -m "refactor: 미구현 OCR provider 설정 제거

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: settings-tab.ts에서 미구현 provider UI 제거 및 Confidence Threshold를 숫자 입력으로 변경

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: settings-tab.ts 수정**

`displayOcrSettings` 메서드에서:
- OCR Provider 드롭다운 (`new Setting` + `addDropdown`) 전체 제거
- Confidence Threshold의 `addSlider`를 `addText`로 변경 (숫자 입력)
- `displayProviderConfig` 메서드 호출 제거
- `displayProviderConfig` 메서드 전체 삭제
- TODO 주석 삭제 (API 키 관련 — 더 이상 해당 없음)

수정 후 `displayOcrSettings`:
```typescript
private displayOcrSettings(containerEl: HTMLElement): void {
  containerEl.createEl('h2', { text: 'OCR Settings' });

  const settings = this.callbacks.getSettings();

  new Setting(containerEl)
    .setName('Confidence Threshold')
    .setDesc('Minimum OCR confidence (0-100)')
    .addText((text) =>
      text
        .setPlaceholder('50')
        .setValue(String(settings.ocr.confidenceThreshold))
        .onChange(async (value) => {
          const num = Number(value);
          if (!Number.isNaN(num) && num >= 0 && num <= 100) {
            settings.ocr.confidenceThreshold = num;
            await this.callbacks.saveSettings(settings);
          }
        })
    );
}
```

**Step 2: typecheck 실행**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: PASS

**Step 3: 테스트 실행**

Run: `pnpm --filter @petrify/obsidian-plugin test`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "refactor: OCR provider 드롭다운 제거, Confidence Threshold를 숫자 입력으로 변경

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3: main.ts에서 provider 관련 불필요 코드 정리

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:75`

**Step 1: main.ts 확인 및 정리**

현재 `main.ts:75`에서 `this.settings.ocr.confidenceThreshold` 를 사용하고 있으므로 이미 정상.
`this.settings.ocr.provider`를 참조하는 코드가 없는지 확인만 하면 됨.

Run: `grep -n "provider" packages/obsidian-plugin/src/main.ts`
Expected: 결과 없음 (이미 provider를 사용하지 않고 있음)

main.ts에 변경이 필요 없으면 이 태스크는 스킵.

**Step 2: 전체 테스트 실행**

Run: `pnpm test`
Expected: 모든 테스트 PASS

**Step 3: README 설정 테이블 업데이트**

`README.md`의 Obsidian 플러그인 설정 테이블에서:
- `OCR Provider | tesseract (로컬)` 행 제거

**Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: README에서 OCR Provider 설정 항목 제거

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
