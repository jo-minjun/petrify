# Google Drive API Adapter 구현 계획

## 배경

현재 petrify는 Google Drive Desktop 앱이 로컬 파일시스템에 마운트한 경로를 `ChokidarWatcher`로 감시하는 방식으로 동작한다. 하지만 회사 정책상 가상드라이브 마운트가 불가능한 환경에서는 이 방식을 사용할 수 없다.

**해결책**: Google Drive API v3를 직접 사용하여 변경 감지 + 파일 다운로드를 수행하는 `WatcherPort` 어댑터를 새로 만든다.

## 타당성 평가

### 가능한가?

**결론: 가능하다.**

| 현재 방식 (ChokidarWatcher) | Google Drive API 방식 |
|---|---|
| 로컬 파일시스템 watch | `changes.list` API 폴링 |
| `fs.readFile()` → ArrayBuffer | `files.get(alt=media)` → stream → ArrayBuffer |
| 파일 삭제 감지 (unlink) | `change.removed === true` 감지 |
| 즉시 감지 (OS 이벤트) | 폴링 간격만큼 지연 (30~60초) |
| Google Drive Desktop 앱 필수 | OAuth2 인증만 필요 (앱 불필요) |

`WatcherPort` 인터페이스가 이미 잘 추상화되어 있어서 Google Drive API 어댑터를 새 구현체로 제공하면 **core, parser, generator, obsidian-plugin 등 기존 코드 변경이 최소화**된다.

### 제약 사항

1. **실시간성**: 파일시스템 이벤트(즉시) 대비 폴링 지연(30~60초)이 발생한다. 대부분의 노트 동기화 시나리오에서 허용 가능한 수준이다.
2. **OAuth2 인증**: 최초 1회 브라우저 로그인이 필요하다. Refresh token을 저장하면 이후 자동 갱신된다.
3. **API Quota**: 20,000 req/100초 한도. 폴링 1회/30초 기준 분당 2~3회 요청이므로 전혀 문제없다.
4. **Push Notification (Webhook) 불가**: 데스크탑 앱이므로 public HTTPS endpoint가 없어 webhook 방식은 사용할 수 없다. 폴링이 유일한 선택지다.

---

## 아키텍처

### 의존성 방향 (변경 없음)

```
Adapters → Core ← Adapters
```

```
@petrify/watcher-google-drive  ──→  @petrify/core (WatcherPort)
                                          ↑
@petrify/watcher-chokidar      ──────────┘
```

### 새 패키지 위치

```
packages/
└── watcher/
    ├── chokidar/          # 기존 - 로컬 파일시스템 감시
    └── google-drive/      # 신규 - Google Drive API 폴링 감시
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── google-drive-watcher.ts
            ├── google-drive-auth.ts
            ├── google-drive-client.ts
            └── types.ts
```

### 핵심 설계: WatcherPort 구현

`GoogleDriveWatcher`는 `WatcherPort`를 구현하며, 내부적으로 폴링 루프를 돌린다.

```
┌─────────────────────────────────┐
│       GoogleDriveWatcher        │  implements WatcherPort
├─────────────────────────────────┤
│ - pollInterval: number          │
│ - folderId: string              │
│ - pageToken: string             │
│ - client: GoogleDriveClient     │
│ - tokenStore: TokenStore        │
├─────────────────────────────────┤
│ + onFileChange(handler)         │
│ + onFileDelete(handler)         │
│ + onError(handler)              │
│ + start(): Promise<void>        │  → 초기 스캔 + 폴링 시작
│ + stop(): Promise<void>         │  → 폴링 중단
└─────────────────────────────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────┐
│       GoogleDriveClient         │  API 호출 래핑
├─────────────────────────────────┤
│ + listFiles(folderId)           │
│ + getChanges(pageToken)         │
│ + getStartPageToken()           │
│ + downloadFile(fileId)          │
│ + getFile(fileId)               │
└─────────────────────────────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────┐
│       GoogleDriveAuth           │  OAuth2 인증 관리
├─────────────────────────────────┤
│ + authorize(): OAuth2Client     │
│ + getAuthUrl(): string          │
│ + handleAuthCode(code)          │
│ + revokeToken()                 │
└─────────────────────────────────┘
```

---

## 구현 상세

### Phase 1: Core - 인증 모듈 (`google-drive-auth.ts`)

#### 인증 흐름 (OAuth2 Installed App Flow)

```
사용자                     Obsidian Plugin                Google
  │                              │                          │
  │  "Google Drive 연결" 클릭     │                          │
  │ ─────────────────────────>   │                          │
  │                              │ ──── 인증 URL 생성 ─────> │
  │                              │                          │
  │  <── 브라우저 열림 (인증 URL) ──│                          │
  │                              │                          │
  │  Google 로그인 + 권한 동의    │                          │
  │ ────────────────────────────────────────────────────>   │
  │                              │                          │
  │  <── redirect: localhost:PORT/?code=AUTH_CODE ──────────│
  │                              │                          │
  │                              │ ← loopback에서 code 수신  │
  │                              │                          │
  │                              │ ──── code → token 교환 ──>│
  │                              │                          │
  │                              │ <── access + refresh token│
  │                              │                          │
  │                              │  refresh token 저장       │
  │  "연결 완료" 표시             │  (plugin data)           │
  │ <────────────────────────────│                          │
```

#### 구현 사항

```typescript
// google-drive-auth.ts

export interface TokenStore {
  loadTokens(): Promise<OAuthTokens | null>;
  saveTokens(tokens: OAuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface GoogleDriveAuthOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tokenStore: TokenStore;
}

export class GoogleDriveAuth {
  constructor(options: GoogleDriveAuthOptions);

  /** 인증 URL을 생성하고 loopback 서버를 시작하여 authorization code를 수신 */
  async authorize(): Promise<OAuth2Client>;

  /** 저장된 refresh token으로 인증 복구 */
  async restoreSession(): Promise<OAuth2Client | null>;

  /** 인증 상태 확인 */
  isAuthenticated(): boolean;

  /** 토큰 해제 + 저장소 클리어 */
  async revokeToken(): Promise<void>;
}
```

**주요 결정 사항:**

1. **OAuth2 Client ID/Secret 관리**: Obsidian 플러그인 설정에서 사용자가 직접 입력하도록 한다. 사용자가 Google Cloud Console에서 프로젝트를 생성하고 OAuth2 자격증명을 발급받아야 한다.
   - 대안: 플러그인에 Client ID를 하드코딩하되, 이 경우 플러그인 배포 시 Google의 앱 인증(verification) 절차가 필요하다.
   - **권장: 사용자 자체 OAuth2 자격증명 입력 방식** (회사 환경에서 더 유연)

2. **Token 저장**: `TokenStore` 인터페이스로 추상화한다. obsidian-plugin에서 `this.saveData()`를 사용하는 구현체를 제공한다.

3. **Scope**: `https://www.googleapis.com/auth/drive.readonly` (읽기 전용이면 충분)

4. **Loopback redirect**: `http://localhost:<dynamic-port>/oauth2callback` 사용. Node.js `http` 모듈로 임시 서버를 띄우고 code를 수신한 후 즉시 종료.

---

### Phase 2: API 클라이언트 (`google-drive-client.ts`)

```typescript
// google-drive-client.ts

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime: string;   // ISO 8601
  readonly md5Checksum?: string;   // binary 파일만 존재
  readonly size?: string;
  readonly parents?: string[];
}

export interface DriveChange {
  readonly fileId: string;
  readonly removed: boolean;
  readonly file?: DriveFile;
  readonly time: string;
}

export interface ChangesResult {
  readonly changes: DriveChange[];
  readonly newStartPageToken?: string;
  readonly nextPageToken?: string;
}

export class GoogleDriveClient {
  constructor(auth: OAuth2Client);

  /** 특정 폴더 내 파일 목록 조회 */
  async listFiles(folderId: string): Promise<DriveFile[]>;

  /** 변경사항 조회 (pageToken 기반) */
  async getChanges(pageToken: string): Promise<ChangesResult>;

  /** 최초 pageToken 획득 */
  async getStartPageToken(): Promise<string>;

  /** 바이너리 파일 다운로드 → ArrayBuffer 반환 */
  async downloadFile(fileId: string): Promise<ArrayBuffer>;

  /** 단일 파일 메타데이터 조회 */
  async getFile(fileId: string): Promise<DriveFile>;
}
```

**주요 결정 사항:**

1. **googleapis npm 패키지 사용**: Google 공식 Node.js SDK(`googleapis`)를 사용한다. 타입 안전성과 자동 token refresh를 제공한다.

2. **파일 다운로드**: `files.get({ fileId, alt: 'media' }, { responseType: 'stream' })`으로 스트림을 받아 `Buffer.concat()` 후 `ArrayBuffer`로 변환한다.

3. **에러 핸들링 + 재시도**: 429, 500, 502, 503, 504 에러에 대해 exponential backoff (2초, 4초, 8초, 16초) 재시도를 구현한다.

4. **fields 파라미터 최적화**: API 호출 시 필요한 필드만 요청하여 응답 크기를 최소화한다.
   ```
   fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, md5Checksum, size, parents))'
   ```

---

### Phase 3: Watcher 구현 (`google-drive-watcher.ts`)

```typescript
// google-drive-watcher.ts

export interface GoogleDriveWatcherOptions {
  readonly folderId: string;
  readonly pollIntervalMs: number;      // 기본값: 30000 (30초)
  readonly auth: OAuth2Client;
  readonly pageTokenStore: PageTokenStore;
}

export interface PageTokenStore {
  loadPageToken(): Promise<string | null>;
  savePageToken(token: string): Promise<void>;
}

export class GoogleDriveWatcher implements WatcherPort {
  constructor(options: GoogleDriveWatcherOptions);

  onFileChange(handler: (event: FileChangeEvent) => Promise<void>): void;
  onFileDelete(handler: (event: FileDeleteEvent) => Promise<void>): void;
  onError(handler: (error: Error) => void): void;

  async start(): Promise<void>;
  async stop(): Promise<void>;
}
```

#### start() 동작 흐름

```
start()
  │
  ├─ 1. pageToken 복구 시도 (pageTokenStore.loadPageToken)
  │     ├─ 있으면 → 그대로 사용 (이전 세션 이어서)
  │     └─ 없으면 → 초기 스캔 모드
  │
  ├─ 2. 초기 스캔 (pageToken 없는 경우)
  │     ├─ getStartPageToken() → 현재 시점 토큰 저장
  │     ├─ listFiles(folderId) → 폴더 내 전체 파일 목록
  │     └─ 각 파일에 대해 FileChangeEvent 발행
  │         ├─ id: Google Drive fileId
  │         ├─ name: file.name
  │         ├─ extension: name에서 추출
  │         ├─ mtime: Date.parse(file.modifiedTime)
  │         └─ readData: () => client.downloadFile(fileId)
  │
  ├─ 3. 폴링 루프 시작 (setInterval)
  │     └─ pollOnce()
  │
  └─ return
```

#### pollOnce() 동작 흐름

```
pollOnce()
  │
  ├─ 1. client.getChanges(pageToken)
  │
  ├─ 2. 페이지네이션 처리 (nextPageToken이 있으면 반복)
  │
  ├─ 3. 변경사항 필터링
  │     └─ change.file?.parents?.includes(folderId) 확인
  │
  ├─ 4. 변경 유형별 처리
  │     ├─ change.removed === true
  │     │   └─ FileDeleteEvent 발행
  │     │       ├─ id: fileId
  │     │       ├─ name: (캐시에서 조회 또는 API 호출)
  │     │       └─ extension: name에서 추출
  │     │
  │     └─ change.removed === false (추가/수정)
  │         └─ FileChangeEvent 발행
  │             ├─ id: fileId
  │             ├─ name: change.file.name
  │             ├─ extension: name에서 추출
  │             ├─ mtime: Date.parse(change.file.modifiedTime)
  │             └─ readData: () => client.downloadFile(fileId)
  │
  ├─ 5. newStartPageToken 저장
  │     └─ pageTokenStore.savePageToken(newStartPageToken)
  │
  └─ return
```

#### 핵심 설계 결정: `id` 필드 매핑

현재 `ChokidarWatcher`에서 `FileChangeEvent.id`는 **로컬 파일의 절대 경로**이다. `PetrifyService.handleFileChange()`에서 이 `id`를 메타데이터의 `source`로 저장하고, mtime 비교에 사용한다.

Google Drive 어댑터에서는:
- `id`: Google Drive의 `fileId`를 사용한다 (예: `"1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"`)
- 이것은 기존 로컬 경로 기반 id와 충돌하지 않는다
- `ConversionMetadataPort.getMetadata(id)`에서 fileId로 조회하면 된다

```typescript
// FileChangeEvent 생성 예시
const event: FileChangeEvent = {
  id: `gdrive://${file.id}`,          // 프로토콜 접두사로 구분
  name: file.name,
  extension: path.extname(file.name).toLowerCase(),
  mtime: new Date(file.modifiedTime).getTime(),
  readData: () => this.client.downloadFile(file.id),
};
```

`gdrive://` 접두사를 붙여서 로컬 파일 경로와 명확히 구분한다. 이를 통해:
- 같은 파일이 로컬과 Drive 양쪽에서 감시되어도 충돌하지 않는다
- 메타데이터에서 source가 `gdrive://` 로 시작하면 Drive 파일임을 알 수 있다

#### 삭제 이벤트 처리

Changes API에서 `removed: true`인 경우 `file` 필드가 없을 수 있다. 이를 해결하기 위해:
- 내부에 `Map<string, { name: string; extension: string }>` 캐시를 유지한다
- 초기 스캔 시 모든 파일의 id → name 매핑을 캐시한다
- 변경 감지 시 새 파일도 캐시에 추가한다
- 삭제 이벤트 시 캐시에서 name을 조회한다

---

### Phase 4: Obsidian Plugin 통합

#### 설정 확장 (`settings.ts`)

```typescript
// 기존 WatchMapping 확장
export type WatchSourceType = 'local' | 'google-drive';

export interface WatchMapping {
  watchDir: string;               // local: 로컬 경로, google-drive: folder ID
  outputDir: string;
  enabled: boolean;
  parserId: string;
  sourceType: WatchSourceType;    // 신규 필드 (기본값: 'local')
}

// Google Drive 설정 추가
export interface GoogleDriveSettings {
  clientId: string;
  clientSecret: string;
  pollIntervalMs: number;         // 기본값: 30000
  // OAuth tokens는 별도 저장 (보안)
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
  deleteConvertedOnSourceDelete: boolean;
  outputFormat: OutputFormat;
  googleDrive: GoogleDriveSettings;   // 신규
}
```

#### Composition Root 변경 (`main.ts`)

```typescript
// startWatchers() 수정
private async startWatchers(): Promise<void> {
  for (const mapping of this.settings.watchMappings) {
    if (!mapping.enabled) continue;
    if (!mapping.watchDir || !mapping.outputDir) continue;

    let watcher: WatcherPort;

    if (mapping.sourceType === 'google-drive') {
      // Google Drive 매핑인 경우
      const auth = await this.getGoogleDriveAuth();
      if (!auth) continue;  // 인증 안 된 경우 스킵

      watcher = new GoogleDriveWatcher({
        folderId: mapping.watchDir,    // watchDir에 folder ID 저장
        pollIntervalMs: this.settings.googleDrive.pollIntervalMs,
        auth,
        pageTokenStore: this.createPageTokenStore(mapping.watchDir),
      });
    } else {
      // 기존 로컬 매핑
      watcher = new ChokidarWatcher(mapping.watchDir);
    }

    // 이벤트 핸들러 등록 (기존과 동일)
    watcher.onFileChange(async (event) => { ... });
    watcher.onFileDelete(async (event) => { ... });
    watcher.onError((error) => { ... });

    await watcher.start();
    this.watchers.push(watcher);
  }
}
```

핵심: **이벤트 핸들러 등록 코드는 변경 없음**. `WatcherPort` 추상화 덕분에 watcher 생성 부분만 분기하면 된다.

#### 설정 UI 확장 (`settings-tab.ts`)

1. **Google Drive 섹션 추가**:
   - Client ID / Client Secret 입력 필드
   - "Google Drive 연결" / "연결 해제" 버튼
   - 연결 상태 표시 (연결됨 / 미연결)
   - 폴링 간격 설정 (30초 / 60초 / 120초)

2. **Watch Mapping UI 확장**:
   - Source Type 선택: "Local Directory" / "Google Drive Folder"
   - Google Drive 선택 시:
     - Folder ID 입력 필드 (또는 폴더 브라우저 버튼)
     - "폴더 선택" 버튼 → Google Drive API로 폴더 목록을 가져와 트리 표시

---

### Phase 5: SyncOrchestrator 대응

현재 `SyncOrchestrator`는 `SyncFileSystem` 인터페이스를 통해 파일시스템에 접근한다:

```typescript
export interface SyncFileSystem {
  readdir(dirPath: string): Promise<string[]>;
  stat(filePath: string): Promise<{ mtimeMs: number }>;
  readFile(filePath: string): Promise<ArrayBuffer>;
  access(filePath: string): Promise<void>;
  rm(filePath: string, options?: { recursive: boolean }): Promise<void>;
}
```

Google Drive 매핑의 경우, SyncOrchestrator에서 `syncAll()` 호출 시 이 인터페이스를 Google Drive API로 대체하는 구현이 필요하다.

```typescript
// google-drive-sync-fs.ts (obsidian-plugin 내부)
export class GoogleDriveSyncFileSystem implements Pick<SyncFileSystem, 'readdir' | 'stat' | 'readFile' | 'access'> {
  constructor(
    private readonly client: GoogleDriveClient,
    private readonly folderId: string,
  ) {}

  async readdir(): Promise<string[]> {
    const files = await this.client.listFiles(this.folderId);
    return files.map(f => f.name);
  }

  async stat(fileName: string): Promise<{ mtimeMs: number }> {
    const files = await this.client.listFiles(this.folderId);
    const file = files.find(f => f.name === fileName);
    if (!file) throw new Error(`File not found: ${fileName}`);
    return { mtimeMs: new Date(file.modifiedTime).getTime() };
  }

  async readFile(fileName: string): Promise<ArrayBuffer> {
    const files = await this.client.listFiles(this.folderId);
    const file = files.find(f => f.name === fileName);
    if (!file) throw new Error(`File not found: ${fileName}`);
    return this.client.downloadFile(file.id);
  }

  async access(fileName: string): Promise<void> {
    const files = await this.client.listFiles(this.folderId);
    const file = files.find(f => f.name === fileName);
    if (!file) throw new Error(`File not found: ${fileName}`);
  }
}
```

---

## 구현 태스크 목록

### Task 1: `@petrify/watcher-google-drive` 패키지 생성

**파일 생성:**

| 파일 | 내용 |
|------|------|
| `packages/watcher/google-drive/package.json` | 패키지 설정 (dependencies: `googleapis`, `@petrify/core`) |
| `packages/watcher/google-drive/tsconfig.json` | TypeScript 설정 (extends base) |
| `packages/watcher/google-drive/src/index.ts` | Public API export |
| `packages/watcher/google-drive/src/types.ts` | 타입 정의 (DriveFile, DriveChange, Options 등) |
| `packages/watcher/google-drive/src/google-drive-auth.ts` | OAuth2 인증 관리 |
| `packages/watcher/google-drive/src/google-drive-client.ts` | Google Drive API 래핑 클라이언트 |
| `packages/watcher/google-drive/src/google-drive-watcher.ts` | WatcherPort 구현체 |

**package.json:**
```json
{
  "name": "@petrify/watcher-google-drive",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@petrify/core": "workspace:*",
    "googleapis": "^144.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### Task 2: 테스트 작성

**테스트 파일:**

| 파일 | 테스트 내용 |
|------|-------------|
| `packages/watcher/google-drive/tests/google-drive-watcher.test.ts` | WatcherPort 계약 테스트 |
| `packages/watcher/google-drive/tests/google-drive-client.test.ts` | API 클라이언트 단위 테스트 |
| `packages/watcher/google-drive/tests/google-drive-auth.test.ts` | 인증 흐름 단위 테스트 |

**테스트 전략:**
- `googleapis`를 mock하여 API 호출을 시뮬레이션
- `TokenStore`, `PageTokenStore`를 in-memory 구현으로 대체
- 행동 기반 테스트: 폴링 시 FileChangeEvent가 올바르게 발행되는지 검증
- 에러 시나리오: 인증 만료, 네트워크 오류, API rate limit 등

**핵심 테스트 케이스:**

```
GoogleDriveWatcher
  ├─ start()
  │   ├─ 초기 스캔: 폴더 내 모든 파일에 대해 FileChangeEvent 발행
  │   ├─ 저장된 pageToken이 있으면 초기 스캔 생략
  │   └─ 인증 실패 시 onError 핸들러 호출
  │
  ├─ polling
  │   ├─ 파일 추가 감지 → FileChangeEvent 발행
  │   ├─ 파일 수정 감지 → FileChangeEvent 발행
  │   ├─ 파일 삭제 감지 → FileDeleteEvent 발행
  │   ├─ 대상 폴더 외 변경 → 무시
  │   └─ API 에러 시 onError 핸들러 호출 + 폴링 지속
  │
  ├─ readData()
  │   ├─ 호출 시 파일 다운로드 → ArrayBuffer 반환
  │   └─ 다운로드 실패 시 에러 throw
  │
  └─ stop()
      └─ 폴링 루프 중단 + 리소스 정리
```

### Task 3: 루트 설정 업데이트

| 파일 | 변경 내용 |
|------|----------|
| `tsconfig.base.json` | paths에 `@petrify/watcher-google-drive` 추가 |
| `vitest.config.ts` | alias에 `@petrify/watcher-google-drive` 추가 |
| `CLAUDE.md` | 패키지 구조/테이블에 `@petrify/watcher-google-drive` 추가 |
| `README.md` | 패키지 설명 + Google Drive 설정 가이드 추가 |

### Task 4: Obsidian Plugin 통합

| 파일 | 변경 내용 |
|------|----------|
| `settings.ts` | `WatchSourceType`, `GoogleDriveSettings` 추가 |
| `settings-tab.ts` | Google Drive 설정 UI 추가 |
| `main.ts` | `startWatchers()`에서 sourceType별 watcher 분기 |
| `package.json` | `@petrify/watcher-google-drive` 의존성 추가 |

### Task 5: SyncOrchestrator Google Drive 지원

| 파일 | 변경 내용 |
|------|----------|
| `sync-orchestrator.ts` | Google Drive 매핑 처리 분기 (또는 SyncFileSystem 구현 분리) |

---

## 구현 순서

```
Phase 1: @petrify/watcher-google-drive 패키지 뼈대
  ├─ 1.1 패키지 구조 생성 (package.json, tsconfig.json)
  ├─ 1.2 types.ts 정의
  ├─ 1.3 루트 설정 업데이트 (tsconfig, vitest)
  └─ 1.4 pnpm install

Phase 2: 인증 모듈
  ├─ 2.1 google-drive-auth.ts 구현
  ├─ 2.2 TokenStore 인터페이스 정의
  └─ 2.3 테스트 작성

Phase 3: API 클라이언트
  ├─ 3.1 google-drive-client.ts 구현
  ├─ 3.2 재시도 로직 (exponential backoff)
  └─ 3.3 테스트 작성 (googleapis mock)

Phase 4: Watcher 구현
  ├─ 4.1 google-drive-watcher.ts 구현
  ├─ 4.2 폴링 루프 + 변경 감지 + 필터링
  ├─ 4.3 PageTokenStore 인터페이스
  └─ 4.4 테스트 작성

Phase 5: Obsidian Plugin 통합
  ├─ 5.1 settings.ts 확장
  ├─ 5.2 main.ts 수정 (watcher 분기)
  ├─ 5.3 settings-tab.ts UI 추가
  └─ 5.4 SyncOrchestrator 대응

Phase 6: 문서화
  ├─ 6.1 CLAUDE.md 업데이트
  ├─ 6.2 README.md 업데이트
  └─ 6.3 Google Cloud 프로젝트 설정 가이드
```

---

## 의존성

### 신규 npm 패키지

| 패키지 | 버전 | 용도 | 크기 |
|--------|------|------|------|
| `googleapis` | ^144.0.0 | Google Drive API v3 SDK | ~50MB (전체), tree-shaking으로 줄일 수 있음 |

### 대안: `googleapis` 대신 직접 HTTP 호출

`googleapis` 패키지는 모든 Google API를 포함하므로 크기가 크다. Obsidian 플러그인 번들 크기가 중요하다면:

**Option A**: `googleapis` 사용 (권장)
- 장점: 타입 안전, 자동 token refresh, 검증된 구현
- 단점: 패키지 크기 (bundler로 tree-shake 가능)

**Option B**: `google-auth-library` + 직접 fetch
- 장점: 작은 번들 크기
- 단점: API 타입을 직접 정의해야 함, 엣지 케이스 직접 처리

**Option C**: 직접 OAuth2 + fetch 구현 (최소 의존성)
- 장점: 최소 번들 크기, 외부 의존성 없음
- 단점: 구현 비용 높음, 보안 취약점 가능성

Obsidian 플러그인은 esbuild로 번들링하므로 Option A가 적절하다. `googleapis` 중 `drive` API만 import하면 tree-shaking으로 불필요한 부분이 제거된다.

```typescript
// 전체 import 대신
import { google } from 'googleapis';

// drive만 import
import { drive_v3 } from 'googleapis';
```

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| `googleapis` 번들 크기가 너무 큼 | Obsidian 플러그인 로딩 느려짐 | Option B (google-auth-library + fetch)로 전환 |
| Changes API가 폴더 필터링 미지원 | 불필요한 변경 감지로 성능 저하 | 클라이언트 사이드 `parents` 필터링 (이미 계획에 포함) |
| OAuth2 인증 UX가 복잡함 | 사용자 이탈 | 단계별 설정 가이드 제공, 에러 메시지 한글화 |
| Refresh token 7일 만료 (앱 미검증 시) | 주기적 재인증 필요 | Google 앱 검증 프로세스 진행 or 사용자에게 안내 |
| Obsidian에서 loopback 서버가 동작하지 않을 수 있음 | 인증 실패 | `clipboard` fallback: 인증 코드를 클립보드에서 붙여넣기 방식 제공 |
| 회사 방화벽이 Google API를 차단할 수 있음 | API 호출 실패 | Proxy 설정 옵션 제공 |

---

## 향후 확장 가능성

1. **양방향 동기화**: 현재는 읽기 전용(Drive → Obsidian). 향후 `FileSystemPort` 확장으로 Obsidian → Drive 업로드 가능.
2. **Shared Drive 지원**: `supportsAllDrives: true` 파라미터 추가로 공유 드라이브 대응.
3. **선택적 폴더 감시**: 단일 폴더가 아닌 여러 폴더/재귀적 감시 지원.
4. **오프라인 캐시**: 다운로드한 파일을 로컬에 캐시하여 오프라인에서도 동작.
