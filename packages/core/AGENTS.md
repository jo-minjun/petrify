# AGENTS.md

## Package Role

- Define intermediate representation models (Note, Page)
- PetrifyService (core orchestration service)
- Define port interfaces (ParserPort, OcrPort, FileGeneratorPort, ConversionMetadataPort)

## Key Modules

| Directory/File | Role |
|----------|------|
| `models/` | Intermediate representation models (Note, Page) |
| `ports/` | External dependency interfaces (ParserPort, OcrPort, FileGeneratorPort, ConversionMetadataPort) |
| `ocr/` | OCR result filtering utilities |
| `petrify-service.ts` | Core conversion orchestrator (combines ParserPort, OcrPort, FileGeneratorPort) |
| `api.ts` | Public constants (DEFAULT_CONFIDENCE_THRESHOLD) |

## DO

- Export new port interfaces from ports/index.ts
  ```typescript
  export type { ParserPort } from './parser.js';
  export type { OcrPort, OcrResult, OcrRegion } from './ocr.js';
  export type { NewPort } from './new-port.js';
  ```

- Define shared exception classes for adapters to use
  ```typescript
  export class InvalidFileFormatError extends Error { }
  export class ParseError extends Error { }
  ```

## DON'T

- Do not directly import specific parsers/adapters
