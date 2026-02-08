# BRAT 베타 플러그인 릴리즈 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Obsidian BRAT을 통해 베타 플러그인으로 배포할 수 있도록 빌드/릴리즈 파이프라인을 구성한다.

**Architecture:** Tesseract JS 코드를 main.js에 번들링하고, 런타임에 필요한 WASM/Worker 파일은 플러그인 최초 로드 시 GitHub Release에서 자동 다운로드한다. GitHub Actions로 태그 푸시 시 자동 릴리즈를 생성한다. BRAT은 `main.js`와 `manifest.json`을 Release에서 다운로드하고, Tesseract 자산은 플러그인이 자체적으로 다운로드한다.

**Tech Stack:** esbuild, GitHub Actions, Obsidian API (requestUrl), tesseract.js v7

**Worktree:** `.worktrees/brat-release` (브랜치: `feat/brat-release`)

**GitHub Repo:** `jo-minjun/petrify`

---

## Task 1: esbuild 설정 변경 — Tesseract를 main.js에 번들링

**Files:**
- Modify: `packages/obsidian-plugin/esbuild.config.mjs`

현재 `@petrify/ocr-tesseract`가 external로 설정되어 별도 `tesseract-ocr.cjs`로 빌드된다. 이를 제거하여 main.js에 함께 번들링한다. `buildTesseractBundle()` 함수는 더 이상 필요 없다. `copyTesseractFiles()`는 dev 모드 로컬 테스트용으로 유지하되, production 빌드에서도 호출한다 (로컬 테스트 시 worker/core 파일이 필요하므로).

**Step 1: esbuild.config.mjs 수정**

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === 'production';

async function copyTesseractFiles() {
  const targetDir = __dirname;

  // Worker 파일 복사
  const workerSrc = path.resolve(
    __dirname,
    '../../node_modules/.pnpm/tesseract.js@7.0.0/node_modules/tesseract.js/dist/worker.min.js',
  );
  await fs.copyFile(workerSrc, path.join(targetDir, 'worker.min.js'));
  console.log('Copied worker.min.js');

  // Core 파일들 복사
  const coreDir = path.resolve(
    __dirname,
    '../../node_modules/.pnpm/tesseract.js-core@7.0.0/node_modules/tesseract.js-core',
  );
  const coreTargetDir = path.join(targetDir, 'tesseract-core');

  await fs.rm(coreTargetDir, { recursive: true, force: true });
  await fs.mkdir(coreTargetDir, { recursive: true });

  const allowedPrefixes = ['tesseract-core-lstm', 'tesseract-core-simd-lstm'];
  const coreFiles = await fs.readdir(coreDir);
  for (const file of coreFiles) {
    if (file === 'index.js' || allowedPrefixes.some((p) => file.startsWith(p))) {
      await fs.copyFile(path.join(coreDir, file), path.join(coreTargetDir, file));
      console.log(`Copied ${file}`);
    }
  }
}

// Tesseract.js를 Obsidian(Electron) 환경에 맞게 패치하는 플러그인
const tesseractObsidianPlugin = {
  name: 'tesseract-obsidian',
  setup(build) {
    const patchDir = path.resolve(__dirname, 'src/patches');

    // ./worker/node를 ./worker/browser로 교체 (worker_threads 대신 Web Worker 사용)
    build.onResolve({ filter: /\.\/worker\/node$/ }, (args) => {
      if (args.importer.includes('tesseract.js')) {
        const browserWorkerPath = path.resolve(
          path.dirname(args.importer),
          './worker/browser/index.js',
        );
        return { path: browserWorkerPath };
      }
      return null;
    });

    // spawnWorker를 Obsidian용 패치로 교체 (file:// URL → Blob URL)
    build.onResolve({ filter: /\.\/spawnWorker/ }, (args) => {
      if (args.importer.includes('tesseract.js') && args.importer.includes('browser')) {
        const patchPath = path.join(patchDir, 'tesseract-spawn-worker.js');
        return { path: patchPath };
      }
      return null;
    });
  },
};

// 메인 빌드 — Tesseract JS 코드 포함
const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  outfile: 'main.js',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  plugins: [tesseractObsidianPlugin],
});

if (prod) {
  await context.rebuild();
  await copyTesseractFiles();
  process.exit(0);
} else {
  await copyTesseractFiles();
  await context.watch();
  console.log('Watching for changes...');
}
```

핵심 변경:
- `external` 배열에서 `'@petrify/ocr-tesseract'` 제거
- `buildTesseractBundle()` 함수와 호출 제거

**Step 2: 빌드 테스트**

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm --filter @petrify/obsidian-plugin build`
Expected: `main.js` 생성 성공 (크기가 이전보다 커짐, ~1.5MB+), `tesseract-ocr.cjs`는 더 이상 생성되지 않음

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/esbuild.config.mjs
git commit -m "build(obsidian-plugin): Tesseract JS 코드를 main.js에 번들링

별도 tesseract-ocr.cjs 빌드 제거. BRAT 배포를 위해 단일 main.js로 통합."
```

---

## Task 2: main.ts initializeOcr 수정 — 직접 import 사용

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:1-15,180-206`

동적 `require(pluginDir + '/tesseract-ocr.cjs')` 제거하고, 상단에서 직접 `import`한다. workerPath와 corePath는 플러그인 디렉토리 기준 `file://` URL로 설정한다.

**Step 1: main.ts 수정**

import 섹션 변경 (Line 14 근처에 추가):
```typescript
import { TesseractOcr } from '@petrify/ocr-tesseract';
```

`initializeOcr` 메서드 변경 (Line 180-206):
```typescript
  private async initializeOcr(): Promise<void> {
    const { provider, googleVision } = this.settings.ocr;

    if (provider === 'google-vision') {
      this.ocr = new GoogleVisionOcr({
        apiKey: googleVision.apiKey,
        languageHints: googleVision.languageHints,
      });
      return;
    }

    // Tesseract (default)
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'petrify');

    const workerPath = `file://${path.join(pluginDir, 'worker.min.js')}`;
    const corePath = `file://${path.join(pluginDir, 'tesseract-core')}/`;

    const tesseract = new TesseractOcr({ lang: 'kor+eng', workerPath, corePath });
    await tesseract.initialize();
    this.ocr = tesseract;
  }
```

핵심 변경:
- 동적 `require` 제거 → 정적 `import`
- `corePath`를 명시적으로 로컬 `file://` 경로로 설정 (CDN 기본값 대신)

**Step 2: tesseract-loader.ts 삭제**

`packages/obsidian-plugin/src/tesseract-loader.ts`는 더 이상 필요 없으므로 삭제한다.

**Step 3: 타입 체크**

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm typecheck`
Expected: 에러 없음

**Step 4: 빌드 테스트**

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git rm packages/obsidian-plugin/src/tesseract-loader.ts
git commit -m "refactor(obsidian-plugin): Tesseract 동적 require를 정적 import으로 변경

tesseract-loader.ts 삭제. corePath를 로컬 플러그인 디렉토리로 명시적 설정."
```

---

## Task 3: Tesseract 자산 자동 다운로더 구현

**Files:**
- Create: `packages/obsidian-plugin/src/tesseract-asset-downloader.ts`
- Create: `packages/obsidian-plugin/tests/tesseract-asset-downloader.test.ts`
- Modify: `packages/obsidian-plugin/src/main.ts`

플러그인 시작 시 Tesseract 런타임 파일(`worker.min.js`, `tesseract-core/`)이 플러그인 디렉토리에 없으면 GitHub Release에서 `tesseract-assets.zip`을 다운로드하여 압축 해제한다.

### Step 1: 다운로더 테스트 작성

`packages/obsidian-plugin/tests/tesseract-asset-downloader.test.ts`:
```typescript
import { describe, expect, it, vi } from 'vitest';
import { TesseractAssetDownloader } from '../src/tesseract-asset-downloader.js';

function createMockFs(existingFiles: Set<string> = new Set()) {
  return {
    exists: vi.fn((p: string) => Promise.resolve(existingFiles.has(p))),
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve()),
  };
}

function createMockHttp() {
  return {
    download: vi.fn(() =>
      Promise.resolve(new ArrayBuffer(0)),
    ),
  };
}

function createMockZip() {
  return {
    extract: vi.fn(() =>
      Promise.resolve([
        { path: 'worker.min.js', data: new Uint8Array([1]) },
        { path: 'tesseract-core/index.js', data: new Uint8Array([2]) },
      ]),
    ),
  };
}

describe('TesseractAssetDownloader', () => {
  const pluginDir = '/vault/.obsidian/plugins/petrify';
  const version = '0.1.0';

  it('자산이 이미 존재하면 다운로드를 스킵한다', async () => {
    const fs = createMockFs(new Set([
      `${pluginDir}/worker.min.js`,
      `${pluginDir}/tesseract-core`,
    ]));
    const http = createMockHttp();
    const zip = createMockZip();

    const downloader = new TesseractAssetDownloader(fs, http, zip);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('skipped');
    expect(http.download).not.toHaveBeenCalled();
  });

  it('자산이 없으면 다운로드하고 압축 해제한다', async () => {
    const fs = createMockFs();
    const http = createMockHttp();
    const zip = createMockZip();

    const downloader = new TesseractAssetDownloader(fs, http, zip);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('downloaded');
    expect(http.download).toHaveBeenCalledWith(
      expect.stringContaining('tesseract-assets.zip'),
    );
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
  });

  it('다운로드 실패 시 에러를 throw한다', async () => {
    const fs = createMockFs();
    const http = createMockHttp();
    http.download.mockRejectedValue(new Error('Network error'));
    const zip = createMockZip();

    const downloader = new TesseractAssetDownloader(fs, http, zip);
    await expect(downloader.ensureAssets(pluginDir, version)).rejects.toThrow('Network error');
  });
});
```

**Step 2: 테스트 실행 (실패 확인)**

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm --filter @petrify/obsidian-plugin test`
Expected: FAIL — `TesseractAssetDownloader` 모듈이 없음

### Step 3: 다운로더 구현

`packages/obsidian-plugin/src/tesseract-asset-downloader.ts`:
```typescript
import * as path from 'node:path';

export interface AssetFs {
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
  writeFile(filePath: string, data: Uint8Array): Promise<void>;
}

export interface AssetHttp {
  download(url: string): Promise<ArrayBuffer>;
}

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

export interface AssetZip {
  extract(data: ArrayBuffer): Promise<ZipEntry[]>;
}

const REPO = 'jo-minjun/petrify';

export class TesseractAssetDownloader {
  constructor(
    private readonly fs: AssetFs,
    private readonly http: AssetHttp,
    private readonly zip: AssetZip,
  ) {}

  async ensureAssets(
    pluginDir: string,
    version: string,
  ): Promise<'skipped' | 'downloaded'> {
    const workerExists = await this.fs.exists(path.join(pluginDir, 'worker.min.js'));
    const coreExists = await this.fs.exists(path.join(pluginDir, 'tesseract-core'));

    if (workerExists && coreExists) {
      return 'skipped';
    }

    const url = `https://github.com/${REPO}/releases/download/${version}/tesseract-assets.zip`;
    const zipData = await this.http.download(url);
    const entries = await this.zip.extract(zipData);

    for (const entry of entries) {
      const targetPath = path.join(pluginDir, entry.path);
      const dir = path.dirname(targetPath);
      await this.fs.mkdir(dir);
      await this.fs.writeFile(targetPath, entry.data);
    }

    return 'downloaded';
  }
}
```

**Step 4: 테스트 실행 (성공 확인)**

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm --filter @petrify/obsidian-plugin test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/tesseract-asset-downloader.ts packages/obsidian-plugin/tests/tesseract-asset-downloader.test.ts
git commit -m "feat(obsidian-plugin): Tesseract 자산 자동 다운로더 구현

플러그인 디렉토리에 worker.min.js/tesseract-core가 없으면
GitHub Release에서 tesseract-assets.zip을 다운로드하여 압축 해제."
```

---

## Task 4: main.ts에 자산 다운로더 통합

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts`

`initializeOcr` 전에 Tesseract 자산 존재 여부를 확인하고, 없으면 다운로드한다. Obsidian의 `requestUrl` API를 사용하여 HTTP 다운로드를 수행한다. ZIP 압축 해제에는 `JSZip` 등 외부 라이브러리 대신 간단한 접근법을 사용한다: GitHub Release에 zip이 아닌 **개별 파일로 올리고** 하나씩 다운로드하는 방식으로 변경. 이렇면 zip 라이브러리가 불필요하다.

> **설계 변경**: `tesseract-assets.zip` 대신 개별 파일을 GitHub Release에 올리고 하나씩 다운로드한다. zip 라이브러리 의존성을 피하고 구현을 단순화한다.

### Step 1: 다운로더 리팩터링 — 개별 파일 다운로드

`packages/obsidian-plugin/src/tesseract-asset-downloader.ts`를 다음으로 교체:
```typescript
import * as path from 'node:path';

export interface AssetFs {
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
  writeFile(filePath: string, data: ArrayBuffer): Promise<void>;
}

export interface AssetHttp {
  download(url: string): Promise<ArrayBuffer>;
}

const REPO = 'jo-minjun/petrify';

const TESSERACT_FILES = [
  'worker.min.js',
  'tesseract-core/index.js',
  'tesseract-core/tesseract-core-lstm.js',
  'tesseract-core/tesseract-core-lstm.wasm',
  'tesseract-core/tesseract-core-lstm.wasm.js',
  'tesseract-core/tesseract-core-simd-lstm.js',
  'tesseract-core/tesseract-core-simd-lstm.wasm',
  'tesseract-core/tesseract-core-simd-lstm.wasm.js',
];

export class TesseractAssetDownloader {
  constructor(
    private readonly fs: AssetFs,
    private readonly http: AssetHttp,
  ) {}

  async ensureAssets(
    pluginDir: string,
    version: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<'skipped' | 'downloaded'> {
    const workerExists = await this.fs.exists(path.join(pluginDir, 'worker.min.js'));
    const coreExists = await this.fs.exists(path.join(pluginDir, 'tesseract-core'));

    if (workerExists && coreExists) {
      return 'skipped';
    }

    await this.fs.mkdir(path.join(pluginDir, 'tesseract-core'));

    const baseUrl = `https://github.com/${REPO}/releases/download/${version}`;
    const total = TESSERACT_FILES.length;

    for (let i = 0; i < total; i++) {
      const file = TESSERACT_FILES[i];
      const url = `${baseUrl}/${file.replace('/', '--')}`;
      const data = await this.http.download(url);
      await this.fs.writeFile(path.join(pluginDir, file), data);
      onProgress?.(i + 1, total);
    }

    return 'downloaded';
  }
}
```

참고: GitHub Release asset 이름에 `/`를 사용할 수 없으므로 `tesseract-core/index.js` → `tesseract-core--index.js`로 업로드하고, 다운로드 시 복원한다.

### Step 2: 테스트 업데이트

`packages/obsidian-plugin/tests/tesseract-asset-downloader.test.ts`:
```typescript
import { describe, expect, it, vi } from 'vitest';
import { TesseractAssetDownloader } from '../src/tesseract-asset-downloader.js';

function createMockFs(existingFiles: Set<string> = new Set()) {
  return {
    exists: vi.fn((p: string) => Promise.resolve(existingFiles.has(p))),
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve()),
  };
}

function createMockHttp() {
  return {
    download: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
  };
}

describe('TesseractAssetDownloader', () => {
  const pluginDir = '/vault/.obsidian/plugins/petrify';
  const version = '0.1.0';

  it('자산이 이미 존재하면 다운로드를 스킵한다', async () => {
    const fs = createMockFs(new Set([
      `${pluginDir}/worker.min.js`,
      `${pluginDir}/tesseract-core`,
    ]));
    const http = createMockHttp();

    const downloader = new TesseractAssetDownloader(fs, http);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('skipped');
    expect(http.download).not.toHaveBeenCalled();
  });

  it('자산이 없으면 모든 파일을 다운로드한다', async () => {
    const fs = createMockFs();
    const http = createMockHttp();

    const downloader = new TesseractAssetDownloader(fs, http);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('downloaded');
    expect(http.download).toHaveBeenCalledTimes(8);
    expect(http.download).toHaveBeenCalledWith(
      expect.stringContaining('worker.min.js'),
    );
    expect(fs.mkdir).toHaveBeenCalledWith(`${pluginDir}/tesseract-core`);
  });

  it('진행 콜백을 호출한다', async () => {
    const fs = createMockFs();
    const http = createMockHttp();
    const onProgress = vi.fn();

    const downloader = new TesseractAssetDownloader(fs, http);
    await downloader.ensureAssets(pluginDir, version, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(8);
    expect(onProgress).toHaveBeenLastCalledWith(8, 8);
  });

  it('다운로드 실패 시 에러를 throw한다', async () => {
    const fs = createMockFs();
    const http = createMockHttp();
    http.download.mockRejectedValue(new Error('Network error'));

    const downloader = new TesseractAssetDownloader(fs, http);
    await expect(downloader.ensureAssets(pluginDir, version)).rejects.toThrow('Network error');
  });
});
```

### Step 3: main.ts에 다운로더 통합

`initializeOcr` 메서드에서 Tesseract 초기화 전에 자산 다운로드를 호출한다:

```typescript
// import 추가 (상단)
import { TesseractAssetDownloader } from './tesseract-asset-downloader.js';

// initializeOcr 메서드 내 Tesseract 분기:
    // Tesseract (default)
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'petrify');

    const assetFs = {
      exists: (p: string) => fs.access(p).then(() => true).catch(() => false),
      mkdir: (p: string) => fs.mkdir(p, { recursive: true }).then(() => {}),
      writeFile: (p: string, data: ArrayBuffer) => fs.writeFile(p, Buffer.from(data)),
    };
    const assetHttp = {
      download: async (url: string) => {
        const { requestUrl } = await import('obsidian');
        const response = await requestUrl({ url });
        return response.arrayBuffer;
      },
    };

    const downloader = new TesseractAssetDownloader(assetFs, assetHttp);
    const manifest = this.manifest;
    const downloadResult = await downloader.ensureAssets(pluginDir, manifest.version, (current, total) => {
      new Notice(`Petrify: Downloading Tesseract OCR (${current}/${total})...`);
    });
    if (downloadResult === 'downloaded') {
      new Notice('Petrify: Tesseract OCR assets downloaded');
    }

    const workerPath = `file://${path.join(pluginDir, 'worker.min.js')}`;
    const corePath = `file://${path.join(pluginDir, 'tesseract-core')}/`;

    const tesseract = new TesseractOcr({ lang: 'kor+eng', workerPath, corePath });
    await tesseract.initialize();
    this.ocr = tesseract;
```

참고: Obsidian Plugin 클래스의 `this.manifest`는 manifest.json의 내용을 제공한다.

### Step 4: 테스트 실행

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm --filter @petrify/obsidian-plugin test`
Expected: PASS

### Step 5: 타입 체크 + Biome

Run: `cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release && pnpm typecheck && pnpm check`
Expected: 에러 없음

### Step 6: 커밋

```bash
git add packages/obsidian-plugin/src/tesseract-asset-downloader.ts packages/obsidian-plugin/tests/tesseract-asset-downloader.test.ts packages/obsidian-plugin/src/main.ts
git commit -m "feat(obsidian-plugin): Tesseract 자산 자동 다운로더를 플러그인 초기화에 통합

Tesseract OCR 사용 시 worker/core 파일이 없으면
GitHub Release에서 자동 다운로드. Obsidian requestUrl API 사용."
```

---

## Task 5: .gitignore 정리

**Files:**
- Modify: `packages/obsidian-plugin/.gitignore`

`tesseract-ocr.cjs`는 더 이상 생성되지 않지만, `worker.min.js`와 `tesseract-core/`는 로컬 빌드 시 여전히 생성된다. `main.js`도 빌드 아티팩트이므로 유지.

**Step 1: .gitignore 수정**

```
main.js
*.js.map
node_modules/

# Tesseract.js 빌드 아티팩트 (로컬 dev/build 시 생성)
tesseract-core/
worker.min.js
```

`tesseract-ocr.cjs` 항목 제거 (더 이상 생성되지 않으므로).

**Step 2: 커밋**

```bash
git add packages/obsidian-plugin/.gitignore
git commit -m "chore(obsidian-plugin): .gitignore에서 tesseract-ocr.cjs 제거"
```

---

## Task 6: versions.json 생성

**Files:**
- Create: `packages/obsidian-plugin/versions.json`

Obsidian 커뮤니티 플러그인과 BRAT에서 사용하는 버전-최소앱버전 매핑 파일. 현재 manifest.json의 minAppVersion은 `1.11.0`.

**Step 1: versions.json 생성**

```json
{
  "0.1.0": "1.11.0"
}
```

**Step 2: 커밋**

```bash
git add packages/obsidian-plugin/versions.json
git commit -m "chore(obsidian-plugin): versions.json 생성

BRAT 및 커뮤니티 플러그인 배포를 위한 버전-최소앱버전 매핑."
```

---

## Task 7: GitHub Actions release 워크플로우 생성

**Files:**
- Create: `.github/workflows/release.yml`

`v*` 태그 푸시 시 자동으로:
1. 빌드 수행
2. Tesseract 자산 파일들의 이름 변환 (경로 구분자 `/` → `--`)
3. GitHub Release 생성 + `main.js`, `manifest.json`, `versions.json`, Tesseract 자산 파일 첨부

**Step 1: release.yml 생성**

```yaml
name: Release

on:
  push:
    tags:
      - '*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm check
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

      - name: Prepare release assets
        run: |
          cd packages/obsidian-plugin
          mkdir -p release-assets

          # BRAT이 다운로드하는 필수 파일
          cp main.js release-assets/
          cp manifest.json release-assets/
          cp versions.json release-assets/

          # Tesseract 자산 파일 (경로 구분자를 --로 변환)
          cp worker.min.js release-assets/worker.min.js
          for f in tesseract-core/*; do
            name=$(basename "$f")
            cp "$f" "release-assets/tesseract-core--${name}"
          done

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: packages/obsidian-plugin/release-assets/*
          generate_release_notes: true
```

**Step 2: 커밋**

```bash
git add .github/workflows/release.yml
git commit -m "ci: GitHub Actions release 워크플로우 추가

v* 태그 푸시 시 자동 빌드 및 GitHub Release 생성.
main.js, manifest.json, versions.json, Tesseract 자산 파일 첨부."
```

---

## Task 8: 전체 검증 및 최종 커밋

**Step 1: 전체 체크**

```bash
cd /Users/minjun.jo/Projects/me/petrify/.worktrees/brat-release
pnpm typecheck
pnpm test
pnpm biome check
pnpm build
```

Expected: 모두 성공

**Step 2: 빌드 아티팩트 확인**

```bash
ls -la packages/obsidian-plugin/main.js
ls -la packages/obsidian-plugin/worker.min.js
ls packages/obsidian-plugin/tesseract-core/
```

Expected: main.js (Tesseract 포함으로 크기 증가), worker.min.js, tesseract-core/ 디렉토리 존재

**Step 3: Biome 자동 수정 (필요 시)**

```bash
pnpm biome check --write
```

---

## 배포 절차 (수동, 계획 외)

위 Task가 모두 완료되면 다음 순서로 배포:

1. PR 생성 및 머지
2. 태그 생성: `git tag 0.1.0 && git push origin 0.1.0`
3. GitHub Actions가 자동으로 Release 생성
4. 사용자에게 안내: BRAT → "Add Beta Plugin" → `jo-minjun/petrify` 입력
