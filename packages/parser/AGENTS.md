# AGENTS.md

## 패키지 역할

- 각 노트 포맷별 파서 구현 (viwoods, supernote, remarkable 등)
- ParserPort 인터페이스 구현

## 파서 구현 규칙

모든 파서는 ParserPort 인터페이스를 구현해야 한다.

```typescript
import type { Note, ParserPort } from '@petrify/core';

export class ViwoodsParser implements ParserPort {
  readonly extensions = ['.note'];

  async parse(data: ArrayBuffer): Promise<Note> {
    // 구현
  }
}
```

- `extensions`: 지원하는 파일 확장자 배열
- `parse()`: ArrayBuffer를 받아 Note 모델로 변환

## DO

- 새 파서 추가 시 ParserPort 구현
  ```typescript
  export class SupernoteParser implements ParserPort {
    readonly extensions = ['.note'];

    async parse(data: ArrayBuffer): Promise<Note> {
      // 구현
    }
  }
  ```

- 새 파서는 index.ts에서 export
  ```typescript
  export { SupernoteParser } from './parser.js';
  export { NoteParser } from './note-parser.js';
  ```

- core의 공통 예외 클래스 사용
  ```typescript
  import { InvalidNoteFileError, ParseError } from '@petrify/core';

  throw new InvalidNoteFileError('Invalid file format');
  ```

## DON'T

- 파서 간 직접 의존하지 않기 (viwoods가 supernote import 등)
- 파서별 자체 예외 클래스 정의하지 않기 (core의 공통 예외 사용)
