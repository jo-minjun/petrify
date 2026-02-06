# Petrify Code Review Style Guide

이 프로젝트의 코딩 규칙은 `AGENTS.md` 파일들에 정의되어 있습니다.
코드 리뷰 시 반드시 각 `AGENTS.md`의 DO/DON'T 규칙을 기준으로 검토하세요.

- `AGENTS.md` (루트) — 프로젝트 전체 아키텍처, 공통 코딩 규칙
- `packages/core/AGENTS.md` — core 패키지 역할, 포트/모델 규칙
- `packages/core/tests/AGENTS.md` — 테스트 규칙, 유닛/통합 테스트 가이드
- `packages/parser/AGENTS.md` — 파서 구현 규칙, ParserPort 계약

변경된 파일이 속한 패키지의 `AGENTS.md`를 우선 참조하고, 루트 `AGENTS.md`를 공통 기준으로 적용하세요.

## 리뷰 중점 사항

코드 변경을 리뷰할 때 다음 관점에 집중하세요:

### 1. 헥사고날 아키텍처 의존성 방향 위반
- core 패키지에서 어댑터 패키지를 직접 import하는지 확인
- 포트 인터페이스를 우회하는 구현이 있는지 확인

### 2. 에러 처리
- 필수 데이터 실패를 silent fail로 처리하고 있는지 확인
- 적절한 예외 클래스를 사용하는지 확인

### 3. 모노레포 패키지 경계
- 공통 devDependencies가 개별 패키지에 중복 추가되지 않았는지 확인
- 공통 타입이 어댑터 패키지에서 재정의되지 않았는지 확인

### 4. 테스트 품질
- 행동(behavior)을 테스트하는지, 구조(structure)를 테스트하는지 확인
- public API를 통해 테스트하는지 확인

## 리뷰하지 않아도 되는 사항

- **코드 포매팅**: biome.json으로 자동 관리됩니다.
- **단순 타입 안전성**: TypeScript 컴파일러가 보장합니다.
- **CI에서 검증되는 항목**: 빌드, 타입체크, 린트는 CI 파이프라인에서 자동 검증됩니다.
