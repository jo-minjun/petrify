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

## 테스트 유형

### 유닛 테스트
- 각 어댑터의 public API 메서드 검증
- 에러 케이스 필수 포함 (정상 + 에러 쌍)
- mock은 외부 의존성(파일 시스템, OCR API)에만 사용

### 통합 테스트
- PetrifyService 진입점(handleFileChange, convertDroppedFile, handleFileDelete) 레벨
- lightweight fake(in-memory 구현) 사용, vi.mock 지양
- 전체 파이프라인 흐름 검증 (parse → OCR → generate → save)

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
- `expect(true).toBe(true)` 같은 무의미한 assertion 금지
- 내부 구현을 spy로 감시하지 않기
