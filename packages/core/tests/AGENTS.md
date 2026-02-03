# AGENTS.md

## 테스트 프레임워크

- **Vitest** 사용
- 테스트 파일: `*.test.ts`

## 명령어

```bash
# 전체 테스트
pnpm test

# 특정 패키지 테스트
pnpm --filter @petrify/core test

# watch 모드
pnpm test -- --watch
```

## DO

- 새 기능 추가 시 테스트 작성
- 테스트 파일은 `tests/` 디렉터리에 배치
  ```
  packages/core/
  ├── src/
  │   └── models/
  │       └── note.ts
  └── tests/
      └── models/
          └── note.test.ts
  ```

## DON'T

- 테스트 비활성화하지 않기 (skip, only 남기지 않기)
