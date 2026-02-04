# 개발환경 설정 정리 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모노레포의 중복된 devDependencies와 설정 파일을 정리하여 일관성 있는 개발환경 구성

**Architecture:** 공통 devDependencies(typescript, vitest, tsup)를 루트로 통합하고, 개별 패키지의 vitest.config.ts를 삭제하여 루트 설정만 사용

**Tech Stack:** pnpm workspace, vitest, tsup, typescript

---

### Task 1: 불필요한 파일 삭제

**Files:**
- Delete: `package-lock.json`
- Delete: `packages/core/vitest.config.ts`
- Delete: `packages/parser/viwoods/vitest.config.ts`
- Delete: `packages/ocr/gutenye/vitest.config.ts`

**Step 1: package-lock.json 삭제**

```bash
rm package-lock.json
```

**Step 2: vitest.config.ts 파일들 삭제**

```bash
rm packages/core/vitest.config.ts
rm packages/parser/viwoods/vitest.config.ts
rm packages/ocr/gutenye/vitest.config.ts
```

**Step 3: 테스트 실행하여 루트 설정으로 동작 확인**

Run: `pnpm test`
Expected: 모든 테스트 PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: 불필요한 설정 파일 삭제

- package-lock.json 삭제 (pnpm 사용)
- 개별 패키지의 vitest.config.ts 삭제 (루트 설정으로 통합)"
```

---

### Task 2: 루트 package.json에 공통 devDependencies 추가

**Files:**
- Modify: `package.json`

**Step 1: 루트 package.json 수정**

devDependencies에 vitest, tsup 추가:

```json
{
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 2: 의존성 설치**

Run: `pnpm install`
Expected: 성공

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 루트에 공통 devDependencies 추가

- vitest, tsup을 루트 package.json으로 이동"
```

---

### Task 3: 개별 패키지에서 공통 devDependencies 제거

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/parser/viwoods/package.json`
- Modify: `packages/ocr/gutenye/package.json`
- Modify: `packages/obsidian-plugin/package.json`

**Step 1: packages/core/package.json 수정**

devDependencies에서 tsup, vitest, @petrify/parser-viwoods 제거 (@types/lz-string 유지):

```json
{
  "devDependencies": {
    "@types/lz-string": "^1.5.0"
  }
}
```

**Step 2: packages/parser/viwoods/package.json 수정**

devDependencies 섹션 전체 제거:

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
  }
}
```

**Step 3: packages/ocr/gutenye/package.json 수정**

devDependencies 섹션 전체 제거:

```json
{
  "name": "@petrify/ocr-gutenye",
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
    "@gutenye/ocr-browser": "^1.4.0"
  }
}
```

**Step 4: packages/obsidian-plugin/package.json 수정**

devDependencies에서 typescript, vitest 제거 (@types/node, esbuild, obsidian 유지):

```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.25.0",
    "obsidian": "^1.7.0"
  }
}
```

**Step 5: 의존성 재설치**

Run: `pnpm install`
Expected: 성공

**Step 6: 테스트 실행**

Run: `pnpm test`
Expected: 모든 테스트 PASS

**Step 7: 빌드 확인**

Run: `pnpm build`
Expected: 모든 패키지 빌드 성공

**Step 8: 타입체크 확인**

Run: `pnpm typecheck`
Expected: 에러 없음

**Step 9: Commit**

```bash
git add packages/*/package.json packages/*/*/package.json pnpm-lock.yaml
git commit -m "chore: 개별 패키지에서 공통 devDependencies 제거

- core: tsup, vitest, @petrify/parser-viwoods 제거
- parser/viwoods: tsup, vitest 제거
- ocr/gutenye: tsup, vitest 제거
- obsidian-plugin: typescript, vitest 제거"
```

---

### Task 4: tsconfig.json paths 수정

**Files:**
- Modify: `tsconfig.json`

**Step 1: 현재 tsconfig.json 확인 후 paths 수정**

paths에서 잘못된 경로 수정 및 누락된 패키지 추가:

```json
{
  "compilerOptions": {
    "paths": {
      "@petrify/core": ["packages/core/src/index.ts"],
      "@petrify/parser-viwoods": ["packages/parser/viwoods/src/index.ts"],
      "@petrify/ocr-gutenye": ["packages/ocr/gutenye/src/index.ts"]
    }
  }
}
```

**Step 2: 타입체크 확인**

Run: `pnpm typecheck`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "fix: tsconfig.json paths 경로 수정

- parser-viwoods 경로 수정 (parser-viwoods → parser/viwoods)
- ocr-gutenye 경로 추가"
```

---

### Task 5: AGENTS.md 업데이트

**Files:**
- Modify: `AGENTS.md`

**Step 1: DO 섹션에 추가**

"테스트 통과 후 커밋" 항목 뒤에 추가:

```markdown
- 공통 devDependencies(typescript, vitest, tsup)는 루트 package.json에서만 관리
  ```json
  // 루트 package.json
  {
    "devDependencies": {
      "typescript": "^5.3.0",
      "vitest": "^2.0.0",
      "tsup": "^8.0.0"
    }
  }
  ```

- vitest 설정은 루트 vitest.config.ts에서만 관리

- 루트 tsconfig.json paths에 모든 워크스페이스 패키지 경로 명시
  ```json
  {
    "paths": {
      "@petrify/core": ["packages/core/src/index.ts"],
      "@petrify/parser-viwoods": ["packages/parser/viwoods/src/index.ts"],
      "@petrify/ocr-gutenye": ["packages/ocr/gutenye/src/index.ts"]
    }
  }
  ```

- 통합 테스트는 플러그인 패키지(obsidian-plugin) 레벨에서 수행
```

**Step 2: DON'T 섹션에 추가**

"vitest globals: true 사용하지 않기" 항목 뒤에 추가:

```markdown
- 개별 패키지에 공통 devDependencies(typescript, vitest, tsup) 추가하지 않기
- 개별 패키지에 vitest.config.ts 파일 생성하지 않기
- pnpm 사용 시 package-lock.json 남겨두지 않기
- core 패키지에서 어댑터 의존성 추가하지 않기 (devDependencies 포함)
```

**Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md에 개발환경 설정 규칙 추가

- DO: 공통 devDependencies 루트 관리, vitest 루트 설정, tsconfig paths 명시
- DON'T: 개별 패키지 중복 설정 금지"
```

---

## 검증 체크리스트

- [ ] `pnpm install` 성공
- [ ] `pnpm build` 모든 패키지 빌드 성공
- [ ] `pnpm test` 모든 테스트 통과
- [ ] `pnpm typecheck` 에러 없음
- [ ] package-lock.json 삭제됨
- [ ] 개별 vitest.config.ts 파일들 삭제됨
- [ ] 루트 package.json에 vitest, tsup 존재
- [ ] 개별 패키지에 중복 devDependencies 없음
