# AGENTS.md

## Package Role

- Implement parsers for each note format (viwoods, supernote, remarkable, etc.)
- Implement the ParserPort interface

## Parser Implementation Rules

All parsers must implement the ParserPort interface.

```typescript
import type { Note, ParserPort } from '@petrify/core';

export class ViwoodsParser implements ParserPort {
  readonly extensions = ['.note'];

  async parse(data: ArrayBuffer): Promise<Note> {
    // implementation
  }
}
```

- `extensions`: Array of supported file extensions
- `parse()`: Receives an ArrayBuffer and converts it to a Note model

## DO

- Implement ParserPort when adding a new parser
  ```typescript
  export class SupernoteParser implements ParserPort {
    readonly extensions = ['.note'];

    async parse(data: ArrayBuffer): Promise<Note> {
      // implementation
    }
  }
  ```

- Export new parsers from index.ts
  ```typescript
  export { SupernoteParser } from './parser.js';
  export { NoteParser } from './note-parser.js';
  ```

- Use shared exception classes from core
  ```typescript
  import { InvalidFileFormatError, ParseError } from '@petrify/core';

  throw new InvalidFileFormatError('Invalid file format');
  ```

## DON'T

- Do not create direct dependencies between parsers (e.g., viwoods importing supernote)
- Do not define per-parser exception classes (use shared exceptions from core)
