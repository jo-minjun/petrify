# Petrify 모노레포 아키텍처 설계

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** viwoods .note 파일을 Excalidraw 포맷으로 변환하는 프로젝트를 헥사고날 아키텍처 기반 모노레포로 구조화

**Architecture:** 코어에 중간 표현(Note, Page, Stroke)과 포트 인터페이스를 정의하고, 파서와 OCR은 어댑터로 분리. 플러그인이 런타임에 어댑터를 주입하는 의존성 역전 구조.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Obsidian Plugin API

---

## 전체 구조

```
petrify/
├── packages/
│   ├── core/                    # @petrify/core
│   │   ├── src/
│   │   │   ├── models/          # Note, Page, Stroke (중간 표현)
│   │   │   ├── excalidraw/      # Excalidraw 변환 로직
│   │   │   ├── watcher/         # 폴더 감시
│   │   │   ├── ports/           # 인터페이스 정의
│   │   │   │   ├── parser.ts    # ParserPort
│   │   │   │   └── ocr.ts       # OcrPort
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── parser-viwoods/          # @petrify/parser-viwoods
│   │   └── src/                 # NoteParser + ColorExtractor
│   │
│   ├── ocr-tesseract/           # @petrify/ocr-tesseract (나중에)
│   │
│   └── plugin/                  # obsidian-petrify
│       └── src/
│           └── main.ts
│
├── pnpm-workspace.yaml
└── package.json
```

## 데이터 흐름

```
입력 포맷                  중간 표현              출력
──────────                ─────────            ──────
viwoods .note  ─┐
SuperNote      ─┼──→  Note/Page/Stroke  ──→  Excalidraw
reMarkable     ─┘        (core)              (core)
```

## 의존성 흐름

```
┌─────────────────────────────────────────────────────────┐
│                    plugin (obsidian-petrify)            │
│  - 설정 UI (감시 폴더 경로, 사용할 파서/OCR 선택)              │
│  - core + 어댑터들 조합                                   │
└─────────────────────────────────────────────────────────┘
         │
         │ 의존
         ▼
┌─────────────────────────────────────────────────────────┐
│                      @petrify/core                      │
│  - models (Note, Page, Stroke)                          │
│  - excalidraw 변환                                       │
│  - watcher                                              │
│  - ports (ParserPort, OcrPort) ← 인터페이스만             │
└─────────────────────────────────────────────────────────┘
         ▲
         │ 구현
         │
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ parser-viwoods │  │ ocr-tesseract  │  │ ocr-google-    │
│                │  │                │  │ vision         │
└────────────────┘  └────────────────┘  └────────────────┘
```

## 포트 인터페이스

```typescript
// ports/parser.ts
export interface ParserPort {
  /** 지원하는 파일 확장자 */
  extensions: string[];  // e.g., ['.note']

  /** 파일 데이터를 Note 모델로 파싱 */
  parse(data: ArrayBuffer): Promise<Note>;
}

// ports/ocr.ts
export interface OcrPort {
  /** 이미지에서 텍스트 추출 */
  recognize(image: ArrayBuffer): Promise<OcrResult>;
}

export interface OcrResult {
  text: string;
  confidence: number;
  regions: OcrRegion[];  // 텍스트 위치 정보
}
```

## Watcher 동작 흐름

```
사용자 설정
    │
    ▼
┌─────────────────────────────────────────┐
│  Watcher (core)                         │
│  - 감시 폴더 경로들 (여러 개 가능)           │
│  - 파일 변경 감지 (추가/수정)               │
└─────────────────────────────────────────┘
    │ 파일 변경 이벤트
    ▼
┌─────────────────────────────────────────┐
│  확장자로 파서 선택                        │
│  .note → parser-viwoods                 │
│  .sn   → parser-supernote (나중에)       │
└─────────────────────────────────────────┘
    │ Note 모델
    ▼
┌─────────────────────────────────────────┐
│  Excalidraw 변환 + 저장                   │
│  → {vault}/petrify/{원본파일명}.excalidraw.md │
└─────────────────────────────────────────┘
```

## 마이그레이션 매핑

```
현재 (src/)                    새 구조 (packages/)
─────────────                  ──────────────────
models/          ──────────→   core/src/models/
excalidraw.ts    ──────────→   core/src/excalidraw/
excalidraw-md.ts ──────────→   core/src/excalidraw/
exceptions.ts    ──────────→   core/src/exceptions.ts

parser.ts        ──────────→   parser-viwoods/src/
color-extractor.ts ────────→   parser-viwoods/src/
```

---

## Task 1: pnpm workspace 설정

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`

**Step 1: pnpm-workspace.yaml 생성**

```yaml
packages:
  - 'packages/*'
```

**Step 2: 루트 package.json 수정**

```json
{
  "name": "petrify",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 3: 확인**

Run: `pnpm install`
Expected: 성공

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: pnpm workspace 설정"
```

---

## Task 2: @petrify/core 패키지 생성

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

**Step 1: 디렉토리 구조 생성**

```bash
mkdir -p packages/core/src/{models,excalidraw,ports}
```

**Step 2: packages/core/package.json 생성**

```json
{
  "name": "@petrify/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 3: packages/core/tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 4: Commit**

```bash
git add packages/core/
git commit -m "chore: @petrify/core 패키지 구조 생성"
```

---

## Task 3: 모델을 core로 이동

**Files:**
- Move: `src/models/*` → `packages/core/src/models/`
- Move: `tests/models/*` → `packages/core/tests/models/`

**Step 1: 파일 이동**

```bash
mv src/models/* packages/core/src/models/
mv tests/models packages/core/tests/
```

**Step 2: 테스트 실행**

Run: `cd packages/core && pnpm test`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: 모델을 @petrify/core로 이동"
```

---

## Task 4: Excalidraw 변환 로직을 core로 이동

**Files:**
- Move: `src/excalidraw.ts` → `packages/core/src/excalidraw/generator.ts`
- Move: `src/excalidraw-md.ts` → `packages/core/src/excalidraw/md-generator.ts`
- Move: `tests/excalidraw*.ts` → `packages/core/tests/excalidraw/`

**Step 1: 파일 이동**

```bash
mkdir -p packages/core/src/excalidraw packages/core/tests/excalidraw
mv src/excalidraw.ts packages/core/src/excalidraw/generator.ts
mv src/excalidraw-md.ts packages/core/src/excalidraw/md-generator.ts
mv tests/excalidraw.test.ts packages/core/tests/excalidraw/
mv tests/excalidraw-md.test.ts packages/core/tests/excalidraw/
```

**Step 2: packages/core/src/excalidraw/index.ts 생성**

```typescript
export { ExcalidrawGenerator } from './generator';
export type { ExcalidrawData, ExcalidrawElement } from './generator';
export { ExcalidrawMdGenerator } from './md-generator';
```

**Step 3: import 경로 수정 후 테스트**

Run: `cd packages/core && pnpm test`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: Excalidraw 변환 로직을 @petrify/core로 이동"
```

---

## Task 5: 포트 인터페이스 정의

**Files:**
- Create: `packages/core/src/ports/parser.ts`
- Create: `packages/core/src/ports/ocr.ts`
- Create: `packages/core/src/ports/index.ts`

**Step 1: packages/core/src/ports/parser.ts 생성**

```typescript
import type { Note } from '../models';

export interface ParserPort {
  /** 지원하는 파일 확장자 */
  readonly extensions: string[];

  /** 파일 데이터를 Note 모델로 파싱 */
  parse(data: ArrayBuffer): Promise<Note>;
}
```

**Step 2: packages/core/src/ports/ocr.ts 생성**

```typescript
export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  regions: OcrRegion[];
}

export interface OcrPort {
  /** 이미지에서 텍스트 추출 */
  recognize(image: ArrayBuffer): Promise<OcrResult>;
}
```

**Step 3: packages/core/src/ports/index.ts 생성**

```typescript
export type { ParserPort } from './parser';
export type { OcrPort, OcrResult, OcrRegion } from './ocr';
```

**Step 4: Commit**

```bash
git add packages/core/src/ports/
git commit -m "feat: ParserPort, OcrPort 인터페이스 정의"
```

---

## Task 6: @petrify/parser-viwoods 패키지 생성

**Files:**
- Create: `packages/parser-viwoods/package.json`
- Create: `packages/parser-viwoods/tsconfig.json`
- Move: `src/parser.ts` → `packages/parser-viwoods/src/parser.ts`
- Move: `src/color-extractor.ts` → `packages/parser-viwoods/src/color-extractor.ts`

**Step 1: 디렉토리 생성**

```bash
mkdir -p packages/parser-viwoods/src
```

**Step 2: packages/parser-viwoods/package.json 생성**

```json
{
  "name": "@petrify/parser-viwoods",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@petrify/core": "workspace:*",
    "jszip": "^3.10.1",
    "lz-string": "^1.5.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 3: 파일 이동**

```bash
mv src/parser.ts packages/parser-viwoods/src/
mv src/color-extractor.ts packages/parser-viwoods/src/
mv tests/parser.test.ts packages/parser-viwoods/tests/
mv tests/color-extractor.test.ts packages/parser-viwoods/tests/
```

**Step 4: ParserPort 구현으로 래핑**

`packages/parser-viwoods/src/index.ts` 생성:

```typescript
import type { ParserPort } from '@petrify/core';
import { NoteParser } from './parser';

export class ViwoodsParser implements ParserPort {
  readonly extensions = ['.note'];

  private parser = new NoteParser();

  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}

export { NoteParser } from './parser';
export { ColorExtractor } from './color-extractor';
```

**Step 5: 테스트 실행**

Run: `cd packages/parser-viwoods && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: parser를 @petrify/parser-viwoods로 분리"
```

---

## Task 7: core의 공개 API 정리

**Files:**
- Modify: `packages/core/src/index.ts`

**Step 1: packages/core/src/index.ts 수정**

```typescript
// Models
export * from './models';

// Excalidraw
export { ExcalidrawGenerator } from './excalidraw/generator';
export { ExcalidrawMdGenerator } from './excalidraw/md-generator';
export type { ExcalidrawData, ExcalidrawElement } from './excalidraw/generator';

// Ports
export type { ParserPort } from './ports/parser';
export type { OcrPort, OcrResult, OcrRegion } from './ports/ocr';

// Exceptions
export { InvalidNoteFileError, ParseError } from './exceptions';
```

**Step 2: 빌드 확인**

Run: `pnpm -r build`
Expected: 성공

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "refactor: @petrify/core 공개 API 정리"
```

---

## Task 8: 기존 src/ 정리 및 통합 테스트 이동

**Files:**
- Delete: `src/` (빈 디렉토리)
- Move: `tests/integration.test.ts` → `packages/core/tests/`

**Step 1: 통합 테스트 이동**

```bash
mv tests/integration.test.ts packages/core/tests/
```

**Step 2: 통합 테스트에서 parser-viwoods 의존성 추가**

`packages/core/package.json`에 devDependencies 추가:

```json
"devDependencies": {
  "@petrify/parser-viwoods": "workspace:*",
  ...
}
```

**Step 3: 전체 테스트 실행**

Run: `pnpm -r test`
Expected: 모든 패키지 PASS

**Step 4: 기존 src/, tests/ 정리**

```bash
rm -rf src tests
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: 모노레포 구조 전환 완료"
```

---

## Task 9: README.md 작성

**Files:**
- Create: `README.md`

**Step 1: README.md 생성**

```markdown
# Petrify

viwoods .note 파일을 Obsidian Excalidraw 포맷으로 변환하는 도구입니다.

## 패키지 구조

| 패키지 | 설명 |
|--------|------|
| `@petrify/core` | 핵심 모델, Excalidraw 변환, 포트 인터페이스 |
| `@petrify/parser-viwoods` | viwoods .note 파일 파서 |
| `obsidian-petrify` | Obsidian 플러그인 (예정) |

## 설치

```bash
pnpm install
```

## 빌드

```bash
pnpm build
```

## 테스트

```bash
pnpm test
```

## 라이선스

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README.md 추가"
```

---

## Task 10: 마일스톤 문서 작성

**Files:**
- Create: `docs/milestones/v1.0-roadmap.md`

**Step 1: 디렉토리 생성**

```bash
mkdir -p docs/milestones
```

**Step 2: docs/milestones/v1.0-roadmap.md 생성**

```markdown
# Petrify v1.0 로드맵

## Phase 1: 모노레포 구조 전환 ✅
- [x] pnpm workspace 설정
- [x] @petrify/core 패키지 생성
- [x] @petrify/parser-viwoods 패키지 분리
- [x] 포트 인터페이스 정의 (ParserPort, OcrPort)

## Phase 2: OCR 지원
- [ ] OcrPort 상세 설계
- [ ] @petrify/ocr-tesseract 구현
- [ ] 손글씨 인식 → Excalidraw 텍스트 요소 변환

## Phase 3: Watcher 구현
- [ ] 폴더 감시 로직 (chokidar 또는 fs.watch)
- [ ] 파일 변경 이벤트 → 자동 변환
- [ ] 다중 폴더 감시 지원

## Phase 4: Obsidian 플러그인
- [ ] 플러그인 기본 구조
- [ ] 설정 UI (감시 폴더 경로, 파서 선택)
- [ ] core + 어댑터 통합

## Phase 5: 추가 파서
- [ ] @petrify/parser-supernote
- [ ] @petrify/parser-remarkable
```

**Step 3: Commit**

```bash
git add docs/milestones/
git commit -m "docs: v1.0 로드맵 문서 추가"
```
