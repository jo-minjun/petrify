# AGENTS.md

## 아키텍처

### 헥사고날 아키텍처

이 프로젝트는 헥사고날 아키텍처를 따른다.

- **Core**: 핵심 도메인 모델(Note, Page, Stroke)과 변환 로직(ExcalidrawGenerator)
- **Ports**: 외부 의존성을 위한 인터페이스 정의(ParserPort, OcrPort)
- **Adapters**: 포트 인터페이스의 구체적 구현(ViwoodsParser 등)

### 의존성 방향

```
Adapters → Core ← Adapters
```

- 어댑터는 core에 의존한다
- core는 어댑터를 알지 못한다
- core는 포트 인터페이스만 정의하고, 어댑터가 이를 구현한다

### 패키지 구조

```
packages/
├── core/                 # @petrify/core
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods
└── ocr/
    └── gutenye/          # @petrify/ocr-gutenye
```

| 패키지 | 역할 |
|--------|------|
| `@petrify/core` | 중간 표현 모델, Excalidraw 변환, 포트 인터페이스 |
| `@petrify/parser-viwoods` | viwoods .note 파일 파서 (ParserPort 구현) |
| `@petrify/ocr-gutenye` | @gutenye/ocr-browser 래핑 OCR (OcrPort 구현) |

## DO

- 테스트 통과 후 커밋

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

- 에러는 명시적 예외 클래스로 처리하기
  ```typescript
  throw new InvalidNoteFileError('Invalid file format');
  throw new ParseError('Failed to parse stroke data');
  ```

- public API는 index.ts에서 명시적으로 export하기
  ```typescript
  export { ExcalidrawGenerator } from './excalidraw/generator.js';
  export type { ParserPort } from './ports/parser.js';
  ```

- import 경로에 `.js` 확장자 명시
  ```typescript
  import { Note } from './models/index.js';
  ```

- 타입은 `import type` 사용
  ```typescript
  import type { ParserPort } from './ports/parser.js';
  import { ExcalidrawGenerator } from './excalidraw/generator.js';
  ```

- 변경되지 않는 필드는 readonly 사용
  ```typescript
  readonly extensions = ['.note'];
  private readonly parser = new NoteParser();
  ```

- Promise는 async/await 패턴 사용
  ```typescript
  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
  ```

- 필수 데이터 파싱 실패 시 명시적 예외 throw
  ```typescript
  throw new ParseError('Failed to parse stroke data');
  ```

- 선택적 데이터 파싱 실패 시 기본값 반환 + 로깅
  ```typescript
  // 선택적 메타데이터 - 없어도 기본 동작 가능
  } catch {
    return {};
  }
  ```

- vitest에서 describe, it, expect 등 명시적으로 import
  ```typescript
  import { describe, it, expect } from 'vitest';
  ```

## DON'T

- core에서 특정 어댑터 직접 import하지 않기 (의존성 역전 위반)
- 포트 인터페이스를 우회하는 구현 추가하지 않기
- 컴파일 에러 있는 상태로 커밋하지 않기
- 사용하지 않는 import/변수 남기지 않기
- CommonJS 문법(require, module.exports) 사용하지 않기
- any 타입 남용하지 않기
- 필수 데이터 실패를 silent fail로 처리하지 않기
- vitest globals: true 사용하지 않기
- 개별 패키지에 공통 devDependencies(typescript, vitest, tsup) 추가하지 않기
- 개별 패키지에 vitest.config.ts 파일 생성하지 않기
- pnpm 사용 시 package-lock.json 남겨두지 않기
- core 패키지에서 어댑터 의존성 추가하지 않기 (devDependencies 포함)
