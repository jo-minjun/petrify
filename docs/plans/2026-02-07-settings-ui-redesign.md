# Settings UI Redesign

## 목표

옵시디언 플러그인 세팅 화면의 UI 구조를 카테고리 기반으로 재설계하고, 데이터 모델을 Local/Google Drive로 분리한다.

## 주요 변경 사항

1. **데이터 모델**: `watchMappings[]` 단일 배열 → `localWatch` / `googleDrive` 분리
2. **UI 구조**: 평면적 나열 → 카테고리별 섹션 (General, Watch Sources, OCR)
3. **설정 필드 개선**: `deleteConvertedOnSourceDelete` → `autoSync`
4. **Google Drive**: Poll Interval을 분 단위(1~60)로 변경, Auto Polling on/off 추가
5. **Google Drive 폴더 브라우징**: Folder ID 직접 입력 → Modal로 폴더 선택
6. **모든 UI 텍스트**: 영어로 통일

## UI 구조

```
■ General
├ Output Format: [Excalidraw ▼]
└ Auto-sync converted files: [ON/OFF]
  "Automatically update or delete converted files when the source
   changes or is removed. Files with 'keep: true' in frontmatter
   are excluded from both updates and deletions."

■ Watch Sources
├── Local File Watch                         [ON/OFF]
│   ├ [+ Add mapping]
│   └ Mapping 1                               ○  🗑
│      Watch directory:  [/local/path     ]
│      Output directory: [/vault/output   ]
│      Parser:           [viwoods ▼]
│
└── Google Drive                             [ON/OFF]
    ├ Client ID:     [________________]
    ├ Client Secret: [________________]
    ├ Auto Polling:  [ON/OFF]
    ├ Poll Interval: [5] min  (1–60)    ← Auto Polling ON일 때만 표시
    ├ [+ Add mapping]
    └ Mapping 1                               ○  🗑
       Folder:           [📁 Browse]  MyFolder
       Output directory: [/vault/output   ]
       Parser:           [viwoods ▼]

■ OCR
├ Provider: [Tesseract ▼]
├ Google Vision API Key: [________________]   ← Google Vision 선택 시만 표시
├ Language Hints: [ko ✓] [en ✓] [ja] ...     ← Google Vision 선택 시만 표시
├ Confidence Threshold: [__]
└ [Save OCR Settings]
```

## Step 1: 데이터 모델 변경 + 마이그레이션

### 변경 파일
- `packages/obsidian-plugin/src/settings.ts`

### 작업 내용

기존 타입 제거:
- `WatchSourceType`
- `WatchMapping` (sourceType 포함)

새 타입 추가:

```typescript
export interface LocalWatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
}

export interface GoogleDriveMapping {
  folderId: string;
  folderName: string;    // 브라우징 시 선택한 폴더 이름 (표시용)
  outputDir: string;
  enabled: boolean;
  parserId: string;
}

export interface LocalWatchSettings {
  enabled: boolean;
  mappings: LocalWatchMapping[];
}

export interface GoogleDriveSettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  autoPolling: boolean;
  pollIntervalMinutes: number;  // 1~60, 분 단위
  mappings: GoogleDriveMapping[];
}

export interface PetrifySettings {
  outputFormat: OutputFormat;
  autoSync: boolean;
  localWatch: LocalWatchSettings;
  googleDrive: GoogleDriveSettings;
  ocr: OcrSettings;
}
```

DEFAULT_SETTINGS 업데이트:

```typescript
export const DEFAULT_SETTINGS: PetrifySettings = {
  outputFormat: 'excalidraw',
  autoSync: false,
  localWatch: {
    enabled: false,
    mappings: [],
  },
  googleDrive: {
    enabled: false,
    clientId: '',
    clientSecret: '',
    autoPolling: true,
    pollIntervalMinutes: 5,
    mappings: [],
  },
  ocr: {
    provider: 'tesseract',
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    googleVision: {
      apiKey: '',
      languageHints: ['ko', 'en'],
    },
  },
};
```

`WatchMapping` 타입은 **유지하되 deprecated 표시**하고 `sync-orchestrator.ts` 호환용으로만 사용. 또는 `SyncMapping`이라는 공통 인터페이스를 새로 정의하여 sync-orchestrator가 받을 수 있게 한다.

### 검증
- `pnpm typecheck` 통과 (이 단계에서는 컴파일 에러 발생 예상 — 다음 단계에서 해결)

---

## Step 2: main.ts 마이그레이션 로직 + 설정 사용 코드 변경

### 변경 파일
- `packages/obsidian-plugin/src/main.ts`

### 작업 내용

#### 2-1. loadSettings()에 마이그레이션 로직 추가

기존 `data.json`이 구 형식(watchMappings 배열)이면 새 형식으로 변환:

```typescript
private async loadSettings(): Promise<void> {
  const raw = await this.loadData();
  this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

  // 마이그레이션: 구 형식 → 새 형식
  if (raw?.watchMappings && !raw?.localWatch) {
    const oldMappings: OldWatchMapping[] = raw.watchMappings;
    this.settings.localWatch = {
      enabled: oldMappings.some(m => m.sourceType !== 'google-drive' && m.enabled),
      mappings: oldMappings
        .filter(m => (m.sourceType ?? 'local') === 'local')
        .map(m => ({ watchDir: m.watchDir, outputDir: m.outputDir, enabled: m.enabled ?? true, parserId: m.parserId ?? ParserId.Viwoods })),
    };
    this.settings.googleDrive = {
      ...this.settings.googleDrive,
      enabled: oldMappings.some(m => m.sourceType === 'google-drive' && m.enabled),
      mappings: oldMappings
        .filter(m => m.sourceType === 'google-drive')
        .map(m => ({ folderId: m.watchDir, folderName: '', outputDir: m.outputDir, enabled: m.enabled ?? true, parserId: m.parserId ?? ParserId.Viwoods })),
    };

    // 기존 pollIntervalMs → pollIntervalMinutes 변환
    if (raw.googleDrive?.pollIntervalMs) {
      this.settings.googleDrive.pollIntervalMinutes = Math.max(1, Math.round(raw.googleDrive.pollIntervalMs / 60000));
    }

    // deleteConvertedOnSourceDelete → autoSync
    this.settings.autoSync = raw.deleteConvertedOnSourceDelete ?? false;

    // 구 필드 제거 및 저장
    delete (this.settings as any).watchMappings;
    delete (this.settings as any).deleteConvertedOnSourceDelete;
    await this.saveSettings();
  }
}
```

#### 2-2. startWatchers() 변경

Local과 Google Drive 매핑을 각각 순회:

```typescript
private async startWatchers(): Promise<void> {
  // Local watchers
  if (this.settings.localWatch.enabled) {
    for (const mapping of this.settings.localWatch.mappings) {
      if (!mapping.enabled || !mapping.watchDir || !mapping.outputDir) continue;
      const watcher = new ChokidarWatcher(mapping.watchDir);
      this.attachWatcherHandlers(watcher, mapping.outputDir);
      await watcher.start();
      this.watchers.push(watcher);
    }
  }

  // Google Drive watchers
  if (this.settings.googleDrive.enabled && this.settings.googleDrive.autoPolling) {
    const authClient = await this.getGoogleDriveAuthClient();
    if (!authClient) { /* 로그 */ return; }

    for (const mapping of this.settings.googleDrive.mappings) {
      if (!mapping.enabled || !mapping.folderId || !mapping.outputDir) continue;
      const watcher = new GoogleDriveWatcher({
        folderId: mapping.folderId,
        pollIntervalMs: this.settings.googleDrive.pollIntervalMinutes * 60000,
        auth: authClient,
        pageTokenStore: this.createPageTokenStore(mapping.folderId),
      });
      this.attachWatcherHandlers(watcher, mapping.outputDir);
      await watcher.start();
      this.watchers.push(watcher);
    }
  }
}

// 공통 핸들러 등록 헬퍼
private attachWatcherHandlers(watcher: WatcherPort, outputDir: string): void {
  watcher.onFileChange(async (event) => { ... });
  watcher.onFileDelete(async (event) => {
    if (!this.settings.autoSync) return;
    ...
  });
  watcher.onError((error) => { ... });
}
```

#### 2-3. syncAll() 변경

두 매핑 배열을 통합하여 sync-orchestrator에 전달:

```typescript
private async syncAll(): Promise<void> {
  // localWatch.mappings + googleDrive.mappings를 SyncMapping[]으로 변환하여 전달
  const syncMappings = this.buildSyncMappings();
  const result = await this.syncOrchestrator.syncAll(syncMappings, this.settings.autoSync);
  ...
}
```

#### 2-4. getOutputPathForId() 변경

기존 `this.settings.watchMappings.find(...)` → 두 매핑 배열에서 검색.

#### 2-5. settings 참조 포인트 변경

| 기존 | 변경 |
|------|------|
| `this.settings.watchMappings` | `this.settings.localWatch.mappings` + `this.settings.googleDrive.mappings` |
| `this.settings.deleteConvertedOnSourceDelete` | `this.settings.autoSync` |
| `this.settings.googleDrive.pollIntervalMs` | `this.settings.googleDrive.pollIntervalMinutes * 60000` |

### 검증
- `pnpm typecheck` 통과

---

## Step 3: sync-orchestrator.ts 인터페이스 변경

### 변경 파일
- `packages/obsidian-plugin/src/sync-orchestrator.ts`

### 작업 내용

`WatchMapping` 의존성을 `SyncMapping`으로 변경:

```typescript
export interface SyncMapping {
  readonly watchDir: string;   // 로컬 경로 또는 Google Drive folderId
  readonly outputDir: string;
  readonly enabled: boolean;
  readonly parserId: string;
}
```

`syncAll()` 시그니처: `WatchMapping[]` → `SyncMapping[]`

main.ts에서 `LocalWatchMapping`과 `GoogleDriveMapping`을 `SyncMapping`으로 변환하여 전달:
- `LocalWatchMapping` → `{ watchDir, outputDir, enabled, parserId }`
- `GoogleDriveMapping` → `{ watchDir: folderId, outputDir, enabled, parserId }`

### 검증
- `pnpm typecheck` 통과

---

## Step 4: Google Drive Client에 폴더 목록 메서드 추가

### 변경 파일
- `packages/watcher/google-drive/src/google-drive-client.ts`
- `packages/watcher/google-drive/src/index.ts` (export 추가)

### 작업 내용

`GoogleDriveClient`에 `listFolders()` 메서드 추가:

```typescript
async listFolders(parentFolderId?: string): Promise<DriveFile[]> {
  const allFolders: DriveFile[] = [];
  let pageToken: string | undefined;

  const query = parentFolderId
    ? `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  do {
    const res = await this.drive.files.list({
      q: query,
      fields: `nextPageToken, files(${FIELDS_FILE})`,
      pageSize: 100,
      pageToken,
      orderBy: 'name',
    });

    for (const file of res.data.files ?? []) {
      allFolders.push(toDriveFile(file as Record<string, unknown>));
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allFolders;
}
```

### 검증
- `pnpm typecheck` 통과
- `pnpm test --filter @petrify/watcher-google-drive` 통과

---

## Step 5: 폴더 브라우징 모달 구현

### 새 파일
- `packages/obsidian-plugin/src/folder-browse-modal.ts`

### 작업 내용

Obsidian Modal을 확장하여 Google Drive 폴더 트리를 탐색하는 UI 구현:

```typescript
export interface FolderBrowseResult {
  folderId: string;
  folderName: string;
}

export class FolderBrowseModal extends Modal {
  constructor(
    app: App,
    private readonly client: GoogleDriveClient,
    private readonly onSelect: (result: FolderBrowseResult) => void,
  ) { super(app); }
}
```

동작:
1. 모달 열림 → root 폴더 목록 로드 (`listFolders(undefined)`)
2. 폴더 클릭 → 하위 폴더 목록 로드 (`listFolders(folderId)`)
3. "Select" 버튼 → `onSelect()` 콜백 호출
4. 상위 폴더로 돌아가는 "Back" 버튼 (breadcrumb 네비게이션)
5. 로딩 상태 표시

### 검증
- 빌드: `pnpm --filter @petrify/obsidian-plugin build`

---

## Step 6: settings-tab.ts 전면 재작성

### 변경 파일
- `packages/obsidian-plugin/src/settings-tab.ts`

### 작업 내용

기존 5개 display 메서드를 카테고리 기반 3개 섹션으로 재구성:

```typescript
display(): void {
  const { containerEl } = this;
  containerEl.empty();
  this.displayGeneralSettings(containerEl);
  this.displayWatchSourcesSettings(containerEl);
  this.displayOcrSettings(containerEl);
}
```

#### 6-1. displayGeneralSettings()

- **Output Format**: 드롭다운 (excalidraw / markdown)
- **Auto-sync converted files**: 토글 + 설명문 (기존 deleteConvertedOnSourceDelete 대체)

#### 6-2. displayWatchSourcesSettings()

`containerEl.createEl('h2', { text: 'Watch Sources' });`

내부에 2개 서브섹션:

**Local File Watch 서브섹션:**
- 섹션 헤더 + 전체 on/off 토글
- enabled일 때만 매핑 목록 + "Add mapping" 버튼 표시
- 각 매핑:
  - Watch directory (text input)
  - Output directory (text input)
  - Parser (dropdown)
  - Enable/Disable 토글 + Remove 버튼

**Google Drive 서브섹션:**
- 섹션 헤더 + 전체 on/off 토글
- enabled일 때만 하위 설정 표시:
  - Client ID (text)
  - Client Secret (password)
  - Auto Polling 토글
  - Poll Interval (number input, 1~60, autoPolling ON일 때만)
  - 매핑 목록 + "Add mapping" 버튼
  - 각 매핑:
    - Folder: Browse 버튼 + 선택된 폴더 이름 표시
    - Output directory (text input)
    - Parser (dropdown)
    - Enable/Disable 토글 + Remove 버튼

#### 6-3. displayOcrSettings()

기존 OCR 섹션과 동일하되 UI 텍스트를 영어로 통일.

### SettingsTabCallbacks 변경

settings-tab에서 Google Drive 폴더 브라우징을 위해 OAuth2 client가 필요. 콜백 인터페이스에 추가:

```typescript
interface SettingsTabCallbacks {
  readonly getSettings: () => PetrifySettings;
  readonly saveSettings: (settings: PetrifySettings) => Promise<void>;
  readonly saveDataOnly: (settings: PetrifySettings) => Promise<void>;
  readonly getGoogleDriveClient: () => Promise<GoogleDriveClient | null>;
}
```

main.ts에서 구현:

```typescript
getGoogleDriveClient: async () => {
  const auth = await this.getGoogleDriveAuthClient();
  if (!auth) return null;
  return new GoogleDriveClient(auth);
},
```

### 검증
- `pnpm typecheck` 통과
- `pnpm --filter @petrify/obsidian-plugin build` 통과

---

## Step 7: UI 텍스트 영어 통일 + 정리

### 변경 파일
- `packages/obsidian-plugin/src/settings-tab.ts`

### 작업 내용

- 기존 한글 레이블 (`'출력 포맷'`, `'변환 결과 파일 형식'` 등) → 영어로 변경
- 일관된 description 스타일 적용
- CSS 클래스 정리 (매핑 컨테이너 스타일링)

### 검증
- `pnpm --filter @petrify/obsidian-plugin build` 통과

---

## Step 8: 기존 테스트 수정 + 마이그레이션 테스트

### 변경 파일
- 기존 테스트 파일들 중 `watchMappings`/`deleteConvertedOnSourceDelete` 참조하는 것들
- 새 테스트: 마이그레이션 로직 테스트

### 작업 내용

1. 기존 테스트에서 `WatchMapping` → `SyncMapping` 변경
2. `deleteConvertedOnSourceDelete` → `autoSync` 변경
3. 마이그레이션 테스트:
   - 구 형식 data.json → 새 형식으로 올바르게 변환되는지
   - local/google-drive 매핑이 올바르게 분리되는지
   - pollIntervalMs → pollIntervalMinutes 변환
   - 이미 새 형식인 경우 마이그레이션 스킵

### 검증
- `pnpm test` 전체 통과
- `pnpm typecheck` 통과
- `pnpm biome check` 통과

---

## Step 9: settings.ts에서 구 타입 제거

### 변경 파일
- `packages/obsidian-plugin/src/settings.ts`

### 작업 내용

마이그레이션이 검증된 후, 구 타입/필드 완전 제거:
- `WatchSourceType` 타입 삭제
- 구 `WatchMapping` 인터페이스 삭제 (SyncMapping만 유지)
- `deleteConvertedOnSourceDelete` 관련 코드 삭제

### 검증
- `pnpm typecheck` → `pnpm test` → `pnpm biome check` 모두 통과

---

## 영향 범위 요약

| 파일 | 변경 유형 |
|------|-----------|
| `settings.ts` | **전면 수정** — 타입/기본값 재설계 |
| `settings-tab.ts` | **전면 재작성** — UI 카테고리 구조 |
| `main.ts` | **대폭 수정** — 마이그레이션, startWatchers, syncAll, 콜백 |
| `sync-orchestrator.ts` | **소폭 수정** — WatchMapping → SyncMapping |
| `google-drive-client.ts` | **소폭 추가** — listFolders() 메서드 |
| `google-drive/index.ts` | **소폭 수정** — export 추가 |
| `folder-browse-modal.ts` | **신규 생성** |
| 기존 테스트 파일들 | **수정** — 타입/필드명 변경 반영 |

## 위험 요소

1. **마이그레이션 실패**: 기존 사용자의 data.json이 손상될 수 있음 → 마이그레이션 전에 구 데이터 검증 필수
2. **Google Drive 인증 상태**: 폴더 브라우징 시 인증이 안 되어 있으면 → 적절한 에러 메시지 표시
3. **settings-tab.ts 전면 재작성**: 기존 OCR pending 상태 관리 로직이 깨질 수 있음 → OCR 섹션은 가능한 기존 로직 유지
