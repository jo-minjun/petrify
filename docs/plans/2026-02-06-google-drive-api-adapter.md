# Google Drive API Watcher Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 회사 정책상 가상드라이브 마운트가 불가능한 환경을 위해 Google Drive API v3 기반 `WatcherPort` 어댑터(`@petrify/watcher-google-drive`)를 추가하여, Google Drive Desktop 앱 없이 변경 감지 및 파일 동기화를 지원한다.

**Architecture:** `@petrify/watcher-google-drive` 패키지를 `packages/watcher/google-drive/`에 생성한다. OAuth2 인증(`GoogleDriveAuth`), API 래핑(`GoogleDriveClient`), `WatcherPort` 구현체(`GoogleDriveWatcher`)로 구성하며, `changes.list` 폴링으로 변경을 감지하고 `files.get(alt=media)`로 바이너리 파일을 다운로드한다. obsidian-plugin의 Composition Root에서 `sourceType` 분기를 통해 기존 `ChokidarWatcher`와 공존한다.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, googleapis (Google Drive API v3 SDK)

---

## 타당성 평가

**결론: 구현 가능하다.**

| 현재 방식 (ChokidarWatcher) | Google Drive API 방식 |
|---|---|
| 로컬 파일시스템 watch | `changes.list` API 폴링 |
| `fs.readFile()` → ArrayBuffer | `files.get(alt=media)` → stream → ArrayBuffer |
| 파일 삭제 감지 (unlink) | `change.removed === true` 감지 |
| 즉시 감지 (OS 이벤트) | 폴링 간격만큼 지연 (30~60초) |
| Google Drive Desktop 앱 필수 | OAuth2 인증만 필요 (앱 불필요) |

### 제약 사항

1. **실시간성**: 파일시스템 이벤트(즉시) 대비 폴링 지연(30~60초). 노트 동기화 시나리오에서 허용 가능.
2. **OAuth2 인증**: 최초 1회 브라우저 로그인 필요. Refresh token 저장으로 이후 자동 갱신.
3. **API Quota**: 20,000 req/100초. 폴링 1회/30초 기준 분당 2~3회로 문제없음.
4. **Webhook 불가**: 데스크탑 앱이므로 public HTTPS endpoint 없음. 폴링이 유일한 선택지.

---

## Task 1: 패키지 뼈대 생성 + 루트 설정 업데이트

**Files:**
- Create: `packages/watcher/google-drive/package.json`
- Create: `packages/watcher/google-drive/tsconfig.json`
- Create: `packages/watcher/google-drive/src/index.ts`
- Modify: `tsconfig.base.json`
- Modify: `vitest.config.ts`

**Step 1: package.json 생성**

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

**Step 2: tsconfig.json 생성**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../../..",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 3: 빈 index.ts 생성**

```typescript
// packages/watcher/google-drive/src/index.ts
export { GoogleDriveWatcher } from './google-drive-watcher.js';
export { GoogleDriveAuth } from './google-drive-auth.js';
export type {
  GoogleDriveWatcherOptions,
  PageTokenStore,
  TokenStore,
  OAuthTokens,
} from './types.js';
```

**Step 4: 루트 tsconfig.base.json에 paths 추가**

```json
{
  "paths": {
    "@petrify/watcher-google-drive": ["packages/watcher/google-drive/src/index.ts"]
  }
}
```

**Step 5: 루트 vitest.config.ts에 alias 추가**

```typescript
'@petrify/watcher-google-drive': path.resolve(__dirname, 'packages/watcher/google-drive/src/index.ts'),
```

**Step 6: pnpm install 실행**

Run: `pnpm install`
Expected: 성공 (`packages/watcher/*` 패턴이 이미 pnpm-workspace.yaml에 존재)

**Step 7: 커밋**

```bash
git add packages/watcher/google-drive/package.json packages/watcher/google-drive/tsconfig.json packages/watcher/google-drive/src/index.ts tsconfig.base.json vitest.config.ts pnpm-lock.yaml
git commit -m "feat: @petrify/watcher-google-drive 패키지 뼈대 생성"
```

---

## Task 2: 타입 정의

**Files:**
- Create: `packages/watcher/google-drive/src/types.ts`

**Step 1: 타입 파일 작성**

```typescript
// packages/watcher/google-drive/src/types.ts
import type { OAuth2Client } from 'google-auth-library';

// --- OAuth2 인증 ---

export interface OAuthTokens {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expiry_date: number;
}

export interface TokenStore {
  loadTokens(): Promise<OAuthTokens | null>;
  saveTokens(tokens: OAuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface GoogleDriveAuthOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tokenStore: TokenStore;
}

// --- Google Drive API ---

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime: string;
  readonly md5Checksum?: string;
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

// --- Watcher ---

export interface PageTokenStore {
  loadPageToken(): Promise<string | null>;
  savePageToken(token: string): Promise<void>;
}

export interface GoogleDriveWatcherOptions {
  readonly folderId: string;
  readonly pollIntervalMs: number;
  readonly auth: OAuth2Client;
  readonly pageTokenStore: PageTokenStore;
}
```

**Step 2: typecheck 확인**

Run: `pnpm --filter @petrify/watcher-google-drive typecheck`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/watcher/google-drive/src/types.ts
git commit -m "feat(watcher-google-drive): 타입 정의"
```

---

## Task 3: GoogleDriveAuth 인증 모듈 구현

**Files:**
- Create: `packages/watcher/google-drive/src/google-drive-auth.ts`
- Create: `packages/watcher/google-drive/tests/google-drive-auth.test.ts`

**Step 1: 테스트 작성**

```typescript
// packages/watcher/google-drive/tests/google-drive-auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveAuth } from '../src/google-drive-auth.js';
import type { TokenStore, OAuthTokens } from '../src/types.js';

function createInMemoryTokenStore(): TokenStore & { tokens: OAuthTokens | null } {
  return {
    tokens: null,
    async loadTokens() { return this.tokens; },
    async saveTokens(t) { this.tokens = t; },
    async clearTokens() { this.tokens = null; },
  };
}

describe('GoogleDriveAuth', () => {
  let tokenStore: ReturnType<typeof createInMemoryTokenStore>;
  let auth: GoogleDriveAuth;

  beforeEach(() => {
    tokenStore = createInMemoryTokenStore();
    auth = new GoogleDriveAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tokenStore,
    });
  });

  it('저장된 토큰이 없으면 restoreSession은 null을 반환한다', async () => {
    const client = await auth.restoreSession();
    expect(client).toBeNull();
  });

  it('저장된 refresh token이 있으면 restoreSession은 OAuth2Client를 반환한다', async () => {
    tokenStore.tokens = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expiry_date: Date.now() + 3600_000,
    };

    const client = await auth.restoreSession();
    expect(client).not.toBeNull();
  });

  it('초기 상태에서 isAuthenticated는 false를 반환한다', () => {
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('revokeToken은 토큰 저장소를 클리어한다', async () => {
    tokenStore.tokens = {
      access_token: 'test',
      refresh_token: 'test',
      expiry_date: Date.now(),
    };

    await auth.revokeToken();
    expect(tokenStore.tokens).toBeNull();
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/watcher-google-drive test`
Expected: FAIL - `google-drive-auth.js` 모듈 없음

**Step 3: 구현**

```typescript
// packages/watcher/google-drive/src/google-drive-auth.ts
import { OAuth2Client } from 'google-auth-library';
import type { GoogleDriveAuthOptions, TokenStore, OAuthTokens } from './types.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const REDIRECT_URI = 'http://localhost';

export class GoogleDriveAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenStore: TokenStore;
  private client: OAuth2Client | null = null;

  constructor(options: GoogleDriveAuthOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.tokenStore = options.tokenStore;
  }

  async restoreSession(): Promise<OAuth2Client | null> {
    const tokens = await this.tokenStore.loadTokens();
    if (!tokens?.refresh_token) return null;

    const client = new OAuth2Client(this.clientId, this.clientSecret, REDIRECT_URI);
    client.setCredentials({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    });

    client.on('tokens', async (newTokens) => {
      await this.tokenStore.saveTokens({
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
      });
    });

    this.client = client;
    return client;
  }

  getAuthUrl(): string {
    const client = new OAuth2Client(this.clientId, this.clientSecret, REDIRECT_URI);
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async handleAuthCode(code: string): Promise<OAuth2Client> {
    const client = new OAuth2Client(this.clientId, this.clientSecret, REDIRECT_URI);
    const { tokens } = await client.getToken(code);

    await this.tokenStore.saveTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
    });

    client.setCredentials(tokens);
    this.client = client;
    return client;
  }

  isAuthenticated(): boolean {
    return this.client !== null;
  }

  async revokeToken(): Promise<void> {
    this.client = null;
    await this.tokenStore.clearTokens();
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/watcher-google-drive test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/watcher/google-drive/src/google-drive-auth.ts packages/watcher/google-drive/tests/google-drive-auth.test.ts
git commit -m "feat(watcher-google-drive): GoogleDriveAuth 인증 모듈 구현"
```

---

## Task 4: GoogleDriveClient API 클라이언트 구현

**Files:**
- Create: `packages/watcher/google-drive/src/google-drive-client.ts`
- Create: `packages/watcher/google-drive/tests/google-drive-client.test.ts`

**Step 1: 테스트 작성**

```typescript
// packages/watcher/google-drive/tests/google-drive-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveClient } from '../src/google-drive-client.js';

// googleapis mock
vi.mock('googleapis', () => {
  const mockDrive = {
    files: {
      list: vi.fn(),
      get: vi.fn(),
    },
    changes: {
      list: vi.fn(),
      getStartPageToken: vi.fn(),
    },
  };
  return {
    google: {
      drive: vi.fn(() => mockDrive),
    },
    _mockDrive: mockDrive,
  };
});

describe('GoogleDriveClient', () => {
  it('listFiles는 지정 폴더의 파일 목록을 반환한다', async () => {
    const { _mockDrive } = await import('googleapis') as any;
    _mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00Z' },
        ],
      },
    });

    const client = new GoogleDriveClient({} as any);
    const files = await client.listFiles('folder-id');

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.note');
  });

  it('getStartPageToken은 초기 토큰을 반환한다', async () => {
    const { _mockDrive } = await import('googleapis') as any;
    _mockDrive.changes.getStartPageToken.mockResolvedValue({
      data: { startPageToken: '12345' },
    });

    const client = new GoogleDriveClient({} as any);
    const token = await client.getStartPageToken();

    expect(token).toBe('12345');
  });

  it('getChanges는 변경사항 목록을 반환한다', async () => {
    const { _mockDrive } = await import('googleapis') as any;
    _mockDrive.changes.list.mockResolvedValue({
      data: {
        changes: [
          { fileId: 'f1', removed: false, file: { id: 'f1', name: 'test.note', modifiedTime: '2026-01-01T00:00:00Z', parents: ['folder-id'] } },
        ],
        newStartPageToken: '12346',
      },
    });

    const client = new GoogleDriveClient({} as any);
    const result = await client.getChanges('12345');

    expect(result.changes).toHaveLength(1);
    expect(result.newStartPageToken).toBe('12346');
  });

  it('downloadFile은 ArrayBuffer를 반환한다', async () => {
    const { Readable } = await import('stream');
    const { _mockDrive } = await import('googleapis') as any;

    const stream = Readable.from([Buffer.from('test-data')]);
    _mockDrive.files.get.mockResolvedValue({ data: stream });

    const client = new GoogleDriveClient({} as any);
    const buffer = await client.downloadFile('file-id');

    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/watcher-google-drive test`
Expected: FAIL - `google-drive-client.js` 모듈 없음

**Step 3: 구현**

```typescript
// packages/watcher/google-drive/src/google-drive-client.ts
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { DriveFile, DriveChange, ChangesResult } from './types.js';

const FIELDS_FILE = 'id, name, mimeType, modifiedTime, md5Checksum, size, parents';
const FIELDS_CHANGES = `nextPageToken, newStartPageToken, changes(fileId, removed, file(${FIELDS_FILE}))`;

export class GoogleDriveClient {
  private readonly drive;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  async listFiles(folderId: string): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const res = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: `nextPageToken, files(${FIELDS_FILE})`,
        pageSize: 100,
        pageToken,
      });

      for (const file of res.data.files ?? []) {
        allFiles.push(file as DriveFile);
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allFiles;
  }

  async getStartPageToken(): Promise<string> {
    const res = await this.drive.changes.getStartPageToken({});
    return res.data.startPageToken!;
  }

  async getChanges(pageToken: string): Promise<ChangesResult> {
    const allChanges: DriveChange[] = [];
    let currentToken = pageToken;
    let newStartPageToken: string | undefined;

    do {
      const res = await this.drive.changes.list({
        pageToken: currentToken,
        fields: FIELDS_CHANGES,
        includeRemoved: true,
        pageSize: 100,
      });

      for (const change of res.data.changes ?? []) {
        allChanges.push(change as DriveChange);
      }

      if (res.data.newStartPageToken) {
        newStartPageToken = res.data.newStartPageToken;
        break;
      }

      currentToken = res.data.nextPageToken!;
    } while (currentToken);

    return {
      changes: allChanges,
      newStartPageToken,
    };
  }

  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' },
    );

    const chunks: Buffer[] = [];
    for await (const chunk of res.data as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const res = await this.drive.files.get({
      fileId,
      fields: FIELDS_FILE,
    });
    return res.data as DriveFile;
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/watcher-google-drive test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/watcher/google-drive/src/google-drive-client.ts packages/watcher/google-drive/tests/google-drive-client.test.ts
git commit -m "feat(watcher-google-drive): GoogleDriveClient API 클라이언트 구현"
```

---

## Task 5: GoogleDriveWatcher 구현 (WatcherPort)

**Files:**
- Create: `packages/watcher/google-drive/src/google-drive-watcher.ts`
- Create: `packages/watcher/google-drive/tests/google-drive-watcher.test.ts`

**Step 1: 테스트 작성**

```typescript
// packages/watcher/google-drive/tests/google-drive-watcher.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileChangeEvent, FileDeleteEvent } from '@petrify/core';
import { GoogleDriveWatcher } from '../src/google-drive-watcher.js';
import type { PageTokenStore } from '../src/types.js';

// GoogleDriveClient mock
vi.mock('../src/google-drive-client.js', () => ({
  GoogleDriveClient: vi.fn().mockImplementation(() => ({
    listFiles: vi.fn().mockResolvedValue([]),
    getStartPageToken: vi.fn().mockResolvedValue('token-1'),
    getChanges: vi.fn().mockResolvedValue({ changes: [], newStartPageToken: 'token-2' }),
    downloadFile: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  })),
}));

function createInMemoryPageTokenStore(): PageTokenStore {
  let token: string | null = null;
  return {
    async loadPageToken() { return token; },
    async savePageToken(t) { token = t; },
  };
}

describe('GoogleDriveWatcher', () => {
  let watcher: GoogleDriveWatcher;
  let pageTokenStore: PageTokenStore;

  beforeEach(() => {
    vi.useFakeTimers();
    pageTokenStore = createInMemoryPageTokenStore();
    watcher = new GoogleDriveWatcher({
      folderId: 'test-folder-id',
      pollIntervalMs: 30000,
      auth: {} as any,
      pageTokenStore,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    vi.useRealTimers();
  });

  it('WatcherPort 인터페이스를 구현한다', () => {
    expect(typeof watcher.onFileChange).toBe('function');
    expect(typeof watcher.onFileDelete).toBe('function');
    expect(typeof watcher.onError).toBe('function');
    expect(typeof watcher.start).toBe('function');
    expect(typeof watcher.stop).toBe('function');
  });

  it('start 시 초기 스캔으로 FileChangeEvent를 발행한다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);
    vi.mocked(mockClient.listFiles).mockResolvedValue([
      { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
    ]);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].name).toBe('test.note');
  });

  it('저장된 pageToken이 있으면 초기 스캔을 생략한다', async () => {
    await pageTokenStore.savePageToken('existing-token');

    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();

    expect(vi.mocked(mockClient.listFiles)).not.toHaveBeenCalled();
  });

  it('폴링으로 파일 추가를 감지하면 FileChangeEvent를 발행한다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);
    vi.mocked(mockClient.getChanges).mockResolvedValue({
      changes: [{
        fileId: 'f1',
        removed: false,
        file: { id: 'f1', name: 'new.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
        time: '2026-01-01T00:00:00.000Z',
      }],
      newStartPageToken: 'token-3',
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(events.some((e) => e.name === 'new.note')).toBe(true);
  });

  it('폴링으로 파일 삭제를 감지하면 FileDeleteEvent를 발행한다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);

    // 초기 스캔에서 파일 등록 (캐시에 추가)
    vi.mocked(mockClient.listFiles).mockResolvedValue([
      { id: 'f1', name: 'deleted.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
    ]);

    // 폴링에서 삭제 감지
    vi.mocked(mockClient.getChanges).mockResolvedValue({
      changes: [{ fileId: 'f1', removed: true, time: '2026-01-02T00:00:00.000Z' }],
      newStartPageToken: 'token-3',
    });

    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileChange(async () => {});
    watcher.onFileDelete(async (event) => { deleteEvents.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(deleteEvents.some((e) => e.name === 'deleted.note')).toBe(true);
  });

  it('대상 폴더 외 변경은 무시한다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);
    vi.mocked(mockClient.getChanges).mockResolvedValue({
      changes: [{
        fileId: 'f-other',
        removed: false,
        file: { id: 'f-other', name: 'other.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['other-folder-id'] },
        time: '2026-01-01T00:00:00.000Z',
      }],
      newStartPageToken: 'token-3',
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(events.filter((e) => e.name === 'other.note')).toHaveLength(0);
  });

  it('API 에러 시 onError 핸들러를 호출하고 폴링을 지속한다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);
    vi.mocked(mockClient.getChanges)
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ changes: [], newStartPageToken: 'token-3' });

    const errors: Error[] = [];
    watcher.onFileChange(async () => {});
    watcher.onError((error) => { errors.push(error); });

    await watcher.start();

    // 첫 번째 폴링: 에러
    await vi.advanceTimersByTimeAsync(30000);
    expect(errors).toHaveLength(1);

    // 두 번째 폴링: 정상 (폴링 지속 확인)
    await vi.advanceTimersByTimeAsync(30000);
    expect(vi.mocked(mockClient.getChanges)).toHaveBeenCalledTimes(2);
  });

  it('stop 후 폴링이 중단된다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);

    await watcher.start();
    await watcher.stop();

    const callCount = vi.mocked(mockClient.getChanges).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);

    expect(vi.mocked(mockClient.getChanges).mock.calls.length).toBe(callCount);
  });

  it('readData 호출 시 파일을 다운로드하여 ArrayBuffer를 반환한다', async () => {
    const { GoogleDriveClient } = await import('../src/google-drive-client.js');
    const mockClient = new GoogleDriveClient({} as any);
    vi.mocked(mockClient.listFiles).mockResolvedValue([
      { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
    ]);
    vi.mocked(mockClient.downloadFile).mockResolvedValue(new ArrayBuffer(16));

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();

    const data = await events[0].readData();
    expect(data.byteLength).toBe(16);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/watcher-google-drive test`
Expected: FAIL - `google-drive-watcher.js` 모듈 없음

**Step 3: 구현**

```typescript
// packages/watcher/google-drive/src/google-drive-watcher.ts
import * as path from 'path';
import type { WatcherPort, FileChangeEvent, FileDeleteEvent } from '@petrify/core';
import { GoogleDriveClient } from './google-drive-client.js';
import type { GoogleDriveWatcherOptions, DriveFile } from './types.js';

export class GoogleDriveWatcher implements WatcherPort {
  private readonly client: GoogleDriveClient;
  private readonly folderId: string;
  private readonly pollIntervalMs: number;
  private readonly pageTokenStore: GoogleDriveWatcherOptions['pageTokenStore'];
  private readonly fileCache = new Map<string, { name: string; extension: string }>();

  private fileHandler: ((event: FileChangeEvent) => Promise<void>) | null = null;
  private deleteHandler: ((event: FileDeleteEvent) => Promise<void>) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pageToken: string | null = null;

  constructor(options: GoogleDriveWatcherOptions) {
    this.client = new GoogleDriveClient(options.auth);
    this.folderId = options.folderId;
    this.pollIntervalMs = options.pollIntervalMs;
    this.pageTokenStore = options.pageTokenStore;
  }

  onFileChange(handler: (event: FileChangeEvent) => Promise<void>): void {
    this.fileHandler = handler;
  }

  onFileDelete(handler: (event: FileDeleteEvent) => Promise<void>): void {
    this.deleteHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  async start(): Promise<void> {
    this.pageToken = await this.pageTokenStore.loadPageToken();

    if (!this.pageToken) {
      // 초기 스캔: 현재 시점 토큰 + 폴더 전체 파일 발행
      this.pageToken = await this.client.getStartPageToken();
      await this.pageTokenStore.savePageToken(this.pageToken);

      const files = await this.client.listFiles(this.folderId);
      for (const file of files) {
        this.cacheFile(file);
        await this.emitFileChange(file);
      }
    }

    // 폴링 루프 시작
    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((error) => {
        this.errorHandler?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.pageToken) return;

    const result = await this.client.getChanges(this.pageToken);

    for (const change of result.changes) {
      // 대상 폴더 필터링
      if (!change.removed && change.file) {
        if (!change.file.parents?.includes(this.folderId)) continue;

        this.cacheFile(change.file);
        await this.emitFileChange(change.file);
      } else if (change.removed) {
        const cached = this.fileCache.get(change.fileId);
        if (!cached) continue;

        await this.emitFileDelete(change.fileId, cached.name, cached.extension);
        this.fileCache.delete(change.fileId);
      }
    }

    if (result.newStartPageToken) {
      this.pageToken = result.newStartPageToken;
      await this.pageTokenStore.savePageToken(this.pageToken);
    }
  }

  private async emitFileChange(file: DriveFile): Promise<void> {
    const ext = path.extname(file.name).toLowerCase();

    const event: FileChangeEvent = {
      id: `gdrive://${file.id}`,
      name: file.name,
      extension: ext,
      mtime: new Date(file.modifiedTime).getTime(),
      readData: () => this.client.downloadFile(file.id),
    };

    try {
      await this.fileHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }

  private async emitFileDelete(fileId: string, name: string, extension: string): Promise<void> {
    const event: FileDeleteEvent = {
      id: `gdrive://${fileId}`,
      name,
      extension,
    };

    try {
      await this.deleteHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }

  private cacheFile(file: DriveFile): void {
    this.fileCache.set(file.id, {
      name: file.name,
      extension: path.extname(file.name).toLowerCase(),
    });
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/watcher-google-drive test`
Expected: PASS

**Step 5: 전체 테스트**

Run: `pnpm test`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add packages/watcher/google-drive/src/google-drive-watcher.ts packages/watcher/google-drive/tests/google-drive-watcher.test.ts
git commit -m "feat(watcher-google-drive): GoogleDriveWatcher 구현 (WatcherPort)"
```

---

## Task 6: Obsidian Plugin 설정 확장

**Files:**
- Modify: `packages/obsidian-plugin/src/settings.ts`
- Modify: `packages/obsidian-plugin/package.json`

**Step 1: settings.ts에 Google Drive 설정 추가**

```typescript
// packages/obsidian-plugin/src/settings.ts 에 추가

export type WatchSourceType = 'local' | 'google-drive';

// WatchMapping에 sourceType 필드 추가
export interface WatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
  sourceType: WatchSourceType;    // 신규 (기본값: 'local')
}

// Google Drive 설정
export interface GoogleDriveSettings {
  clientId: string;
  clientSecret: string;
  pollIntervalMs: number;
}

// PetrifySettings에 googleDrive 필드 추가
export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
  deleteConvertedOnSourceDelete: boolean;
  outputFormat: OutputFormat;
  googleDrive: GoogleDriveSettings;   // 신규
}

// DEFAULT_SETTINGS 업데이트
export const DEFAULT_SETTINGS: PetrifySettings = {
  // ... 기존 필드 ...
  googleDrive: {
    clientId: '',
    clientSecret: '',
    pollIntervalMs: 30000,
  },
};
```

**Step 2: package.json에 의존성 추가**

```json
{
  "dependencies": {
    "@petrify/watcher-google-drive": "workspace:*"
  }
}
```

**Step 3: typecheck 확인**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/settings.ts packages/obsidian-plugin/package.json
git commit -m "feat(plugin): Google Drive 설정 타입 추가"
```

---

## Task 7: Composition Root에서 Watcher 분기

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: import 추가**

```typescript
import { GoogleDriveWatcher, GoogleDriveAuth } from '@petrify/watcher-google-drive';
import type { TokenStore, PageTokenStore } from '@petrify/watcher-google-drive';
```

**Step 2: startWatchers() 수정 - sourceType 분기**

```typescript
private async startWatchers(): Promise<void> {
  for (const mapping of this.settings.watchMappings) {
    if (!mapping.enabled) continue;
    if (!mapping.watchDir || !mapping.outputDir) continue;

    let watcher: WatcherPort;

    if (mapping.sourceType === 'google-drive') {
      const auth = await this.getGoogleDriveAuth();
      if (!auth) continue;

      watcher = new GoogleDriveWatcher({
        folderId: mapping.watchDir,
        pollIntervalMs: this.settings.googleDrive.pollIntervalMs,
        auth,
        pageTokenStore: this.createPageTokenStore(mapping.watchDir),
      });
    } else {
      watcher = new ChokidarWatcher(mapping.watchDir);
    }

    // 이하 이벤트 핸들러 등록은 기존과 동일
    watcher.onFileChange(async (event) => { /* ... */ });
    watcher.onFileDelete(async (event) => { /* ... */ });
    watcher.onError((error) => { /* ... */ });

    await watcher.start();
    this.watchers.push(watcher);
  }
}
```

**Step 3: Google Drive 인증 헬퍼 메서드 추가**

```typescript
private googleDriveAuth: GoogleDriveAuth | null = null;

private async getGoogleDriveAuth(): Promise<OAuth2Client | null> {
  const { clientId, clientSecret } = this.settings.googleDrive;
  if (!clientId || !clientSecret) return null;

  if (!this.googleDriveAuth) {
    this.googleDriveAuth = new GoogleDriveAuth({
      clientId,
      clientSecret,
      tokenStore: this.createTokenStore(),
    });
  }

  return this.googleDriveAuth.restoreSession();
}

private createTokenStore(): TokenStore {
  return {
    loadTokens: async () => {
      const data = await this.loadData();
      return data?.googleDriveTokens ?? null;
    },
    saveTokens: async (tokens) => {
      const data = (await this.loadData()) ?? {};
      data.googleDriveTokens = tokens;
      await this.saveData(data);
    },
    clearTokens: async () => {
      const data = (await this.loadData()) ?? {};
      delete data.googleDriveTokens;
      await this.saveData(data);
    },
  };
}

private createPageTokenStore(folderId: string): PageTokenStore {
  const key = `pageToken_${folderId}`;
  return {
    loadPageToken: async () => {
      const data = await this.loadData();
      return data?.[key] ?? null;
    },
    savePageToken: async (token) => {
      const data = (await this.loadData()) ?? {};
      data[key] = token;
      await this.saveData(data);
    },
  };
}
```

**Step 4: loadSettings()에서 sourceType 기본값 처리**

```typescript
private async loadSettings(): Promise<void> {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  this.settings.watchMappings = this.settings.watchMappings.map((m) => ({
    ...m,
    enabled: m.enabled ?? true,
    parserId: m.parserId ?? ParserId.Viwoods,
    sourceType: m.sourceType ?? 'local',    // 기본값 추가
  }));
}
```

**Step 5: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: PASS

**Step 6: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat(plugin): Composition Root에서 Google Drive Watcher 분기"
```

---

## Task 8: Settings Tab UI 확장

**Files:**
- Modify: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: Google Drive 설정 섹션 추가**

- Client ID / Client Secret 입력 필드 (password 타입)
- "Google Drive 연결" / "연결 해제" 버튼
- 연결 상태 표시
- 폴링 간격 설정 (30초 / 60초 / 120초 드롭다운)

**Step 2: Watch Mapping UI에 Source Type 선택 추가**

- "Local Directory" / "Google Drive Folder" 드롭다운
- Google Drive 선택 시 watchDir 입력란 라벨을 "Folder ID"로 변경

**Step 3: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/settings-tab.ts
git commit -m "feat(plugin): Google Drive 설정 UI 추가"
```

---

## Task 9: SyncOrchestrator Google Drive 대응

**Files:**
- Modify: `packages/obsidian-plugin/src/sync-orchestrator.ts`
- Modify: `packages/obsidian-plugin/src/main.ts`

**Step 1: SyncFileSystem의 Google Drive 구현 추가**

Google Drive 매핑의 경우 `GoogleDriveClient`를 사용하는 `SyncFileSystem` 구현을 제공한다. 기존 `SyncOrchestrator`는 변경하지 않고, `main.ts`에서 매핑의 `sourceType`에 따라 다른 `SyncFileSystem`을 전달한다.

**Step 2: 빌드 확인**

Run: `pnpm --filter @petrify/obsidian-plugin typecheck`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/src/sync-orchestrator.ts packages/obsidian-plugin/src/main.ts
git commit -m "feat(plugin): SyncOrchestrator Google Drive 매핑 지원"
```

---

## Task 10: 문서 업데이트

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: CLAUDE.md 패키지 구조/테이블 업데이트**

패키지 구조에 `google-drive/` 추가:
```
packages/
├── watcher/
│   ├── chokidar/         # @petrify/watcher-chokidar
│   └── google-drive/     # @petrify/watcher-google-drive
```

패키지 테이블에 행 추가:
```
| `@petrify/watcher-google-drive` | Google Drive API 폴링 파일 감시 (WatcherPort 구현) |
```

**Step 2: README.md 업데이트**

Google Drive API 설정 가이드:
- Google Cloud Console에서 프로젝트 생성
- Drive API 활성화
- OAuth2 자격증명 발급
- Obsidian 플러그인 설정에서 Client ID/Secret 입력
- "Google Drive 연결" 버튼으로 인증

**Step 3: 커밋**

```bash
git add CLAUDE.md README.md
git commit -m "docs: Google Drive API 어댑터 문서 업데이트"
```

---

## Task 11: 최종 검증

**Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 모든 패키지 빌드 성공

**Step 2: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 통과

**Step 3: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

---

## 요약

### 최종 패키지 구조

```
packages/
├── core/                           # 변경 없음
├── parser/viwoods/                 # 변경 없음
├── ocr/
│   ├── tesseract/                  # 변경 없음
│   └── google-vision/              # 변경 없음
├── generator/
│   ├── excalidraw/                 # 변경 없음
│   └── markdown/                   # 변경 없음
├── watcher/
│   ├── chokidar/                   # 변경 없음
│   └── google-drive/               # NEW
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts
│       │   ├── google-drive-auth.ts
│       │   ├── google-drive-client.ts
│       │   └── google-drive-watcher.ts
│       └── tests/
│           ├── google-drive-auth.test.ts
│           ├── google-drive-client.test.ts
│           └── google-drive-watcher.test.ts
└── obsidian-plugin/                # MODIFIED
    └── src/
        ├── main.ts                 # watcher 분기 추가
        ├── settings.ts             # GoogleDriveSettings 추가
        └── settings-tab.ts         # Google Drive UI 추가
```

### 신규 의존성

| 패키지 | 용도 |
|--------|------|
| `googleapis` ^144.0.0 | Google Drive API v3 SDK (watcher-google-drive의 dependency) |

### 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| `googleapis` 번들 크기 (~50MB) | `google-auth-library` + 직접 fetch로 전환 가능 |
| Changes API 폴더 필터링 미지원 | 클라이언트 사이드 `parents` 필터링 |
| OAuth2 인증 UX 복잡 | 단계별 가이드 + 에러 메시지 한글화 |
| Refresh token 7일 만료 (앱 미검증) | Google 앱 검증 진행 or 사용자 안내 |
| Loopback 서버 동작 불가 가능성 | clipboard fallback 방식 제공 |
| 회사 방화벽 Google API 차단 | Proxy 설정 옵션 제공 |
