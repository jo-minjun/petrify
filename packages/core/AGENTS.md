# AGENTS.md

## 패키지 역할

- 중간 표현 모델 정의 (Note, Page, Stroke)
- Excalidraw 변환 로직
- 포트 인터페이스 정의 (ParserPort, OcrPort)

## 주요 모듈

| 디렉터리 | 역할 |
|----------|------|
| `models/` | 중간 표현 모델 (Note, Page, Stroke) |
| `excalidraw/` | Excalidraw JSON/MD 변환 로직 |
| `ports/` | 외부 의존성 인터페이스 (ParserPort, OcrPort) |
| `api.ts` | 공개 API (convert, convertToMd) |

## DO

- 새 포트 인터페이스 추가 시 ports/index.ts에서 export
  ```typescript
  export type { ParserPort } from './parser.js';
  export type { OcrPort, OcrResult, OcrRegion } from './ocr.js';
  export type { NewPort } from './new-port.js';
  ```

- 어댑터가 사용할 공통 예외 클래스 정의
  ```typescript
  export class InvalidNoteFileError extends Error { }
  export class ParseError extends Error { }
  ```

## DON'T

- 특정 파서/어댑터 직접 import하지 않기
- 외부 파일 시스템 직접 접근하지 않기 (포트로 추상화)
