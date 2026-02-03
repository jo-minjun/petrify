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
└── ocr/                  # (예정)
    └── tesseract/        # @petrify/ocr-tesseract
```

| 패키지 | 역할 |
|--------|------|
| `@petrify/core` | 중간 표현 모델, Excalidraw 변환, 포트 인터페이스 |
| `@petrify/parser-viwoods` | viwoods .note 파일 파서 (ParserPort 구현) |

## DO

- 테스트 통과 후 커밋

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

## DON'T

- core에서 특정 어댑터 직접 import하지 않기 (의존성 역전 위반)
- 포트 인터페이스를 우회하는 구현 추가하지 않기
- 컴파일 에러 있는 상태로 커밋하지 않기
- 사용하지 않는 import/변수 남기지 않기
- CommonJS 문법(require, module.exports) 사용하지 않기
- any 타입 남용하지 않기
