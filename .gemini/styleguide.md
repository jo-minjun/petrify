# Petrify Code Review Style Guide

이 프로젝트는 Viwoods .note 파일을 Obsidian 호환 포맷(Markdown, Excalidraw)으로 변환하는 TypeScript 모노레포입니다.

## 아키텍처

이 프로젝트는 **헥사고날 아키텍처**를 따릅니다. 리뷰 시 다음 의존성 방향을 반드시 확인하세요:

```
Adapters → Core ← Adapters
```

- **core 패키지**는 도메인 모델과 포트 인터페이스만 정의합니다.
- **어댑터 패키지**가 포트 인터페이스를 구현합니다.
- core는 어댑터를 직접 import하면 안 됩니다 (의존성 역전 위반).
- core 패키지의 `dependencies`나 `devDependencies`에 어댑터 패키지가 포함되면 안 됩니다.

## 반드시 확인할 사항

### 의존성 방향 위반
- core에서 특정 어댑터를 직접 import하는 코드가 있으면 반드시 지적하세요.
- 포트 인터페이스를 우회하는 구현이 있으면 지적하세요.

### TypeScript 규칙
- `import type`을 사용하지 않고 타입을 import하는 경우 지적하세요.
- import 경로에 `.js` 확장자가 누락된 경우 지적하세요.
- `any` 타입이 남용되면 지적하세요.
- CommonJS 문법(`require`, `module.exports`)은 사용하면 안 됩니다.
- 사용하지 않는 import/변수가 있으면 지적하세요.

### 에러 처리
- 필수 데이터 파싱 실패를 silent fail로 처리하면 지적하세요. 명시적 예외 클래스를 사용해야 합니다.
- 선택적 데이터 파싱 실패는 기본값 반환 + 로깅으로 처리해야 합니다.

### 모노레포 규칙
- 공통 devDependencies(typescript, vitest, tsup)가 개별 패키지의 package.json에 추가되면 지적하세요. 루트에서만 관리해야 합니다.
- 개별 패키지에 불필요한 vitest.config.ts가 추가되면 지적하세요. 루트 설정으로 충분한 경우 불필요합니다.
- 공통 타입/인터페이스가 어댑터 패키지에서 재정의되면 지적하세요. @petrify/core에서만 정의해야 합니다.

### 코드 스타일
- 변경되지 않는 필드에 `readonly`가 누락되면 지적하세요.
- Promise 사용 시 async/await 패턴을 따르지 않으면 지적하세요.
- public API가 index.ts에서 export되지 않으면 지적하세요.

### 테스트 규칙
- vitest에서 `globals: true`를 사용하면 지적하세요. describe, it, expect 등을 명시적으로 import해야 합니다.
- 테스트에서 `as any`로 private 멤버에 접근하면 지적하세요.
- 데이터 모델(interface) 생성만 테스트하거나, 설정 기본값만 테스트하거나, 인터페이스 shape만 테스트하는 코드는 불필요합니다.
- 행동(behavior)을 테스트해야 하며, 구조(structure)를 테스트하면 안 됩니다.

### Composition Root
- obsidian-plugin이 유일한 Composition Root입니다. 다른 패키지에서 어댑터를 직접 조립하면 지적하세요.

## 리뷰하지 않아도 되는 사항

- 코드 포매팅: biome.json으로 자동 관리됩니다.
- 단순 타입 안전성: TypeScript 컴파일러가 보장합니다.
