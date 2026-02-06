# keep:true 갱신 방지 기능 확장

## 목표

기존 `keep:true` frontmatter의 역할을 "삭제 방지"에서 "삭제 + 갱신 방지"로 확장한다.

## 현재 상태

- `petrify-service.ts`: `shouldSkipConversion` 메서드 추출 완료 (keep + mtime 체크 통합)
- 테스트/문구 업데이트는 아직 미완료

## 영향받는 파일

| 파일 | 상태 | 변경 내용 |
|------|------|----------|
| `packages/core/src/petrify-service.ts` | **완료** | `shouldSkipConversion()` 메서드 추출, keep 체크 추가 |
| `packages/core/tests/petrify-service.test.ts` | 미완료 | keep:true 파일 갱신 스킵 테스트 추가 |
| `packages/obsidian-plugin/src/settings-tab.ts` | 미완료 | 설명 문구에 갱신 방지 반영 |

## 구현 단계

### Step 1: 테스트 추가 (`petrify-service.test.ts`)

`handleFileChange` describe 블록에 테스트 추가:

```typescript
it('keep이 true면 원본이 변경되어도 null 반환', async () => {
  // metadata에 keep:true, mtime:1000 설정
  // event.mtime을 2000 (더 최신)으로 설정
  // → 결과: null (갱신 차단)
  // → readData 호출되지 않음 (변환 시도 자체를 안 함)
});
```

핵심 검증:
- `handleFileChange`가 `null` 반환
- `event.readData`가 호출되지 않음 (파일 읽기 자체를 스킵했는지 확인)

### Step 2: settings-tab 문구 업데이트

`displayDeleteSettings()` 내 `.setDesc()` 문구 변경:

```
Before: 'Add "keep: true" to a file\'s petrify frontmatter to protect it.'
After:  'Add "keep: true" to a file\'s petrify frontmatter to protect it from deletion and re-conversion.'
```

### Step 3: 검증

```bash
pnpm test
pnpm --filter @petrify/obsidian-plugin build
```

## 변경하지 않는 것

- `ConversionMetadata` 인터페이스 — 이미 `keep?: boolean` 존재
- frontmatter 직렬화/파싱 — 이미 `keep` 지원
- `handleFileDelete()` — 기존 삭제 방지 로직 유지
- `SyncOrchestrator` — `handleFileChange` null 반환 시 이미 스킵 처리됨
