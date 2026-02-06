# AGENTS.md

## 패키지 역할

- 중간 표현 모델 정의 (Note, Page)
- PetrifyService (핵심 오케스트레이션 서비스)
- 포트 인터페이스 정의 (ParserPort, OcrPort, FileGeneratorPort, ConversionMetadataPort)

## 주요 모듈

| 디렉터리/파일 | 역할 |
|----------|------|
| `models/` | 중간 표현 모델 (Note, Page) |
| `ports/` | 외부 의존성 인터페이스 (ParserPort, OcrPort, FileGeneratorPort, ConversionMetadataPort) |
| `ocr/` | OCR 결과 필터링 유틸리티 |
| `petrify-service.ts` | 핵심 변환 오케스트레이터 (ParserPort, OcrPort, FileGeneratorPort 조합) |
| `api.ts` | 공개 상수 (DEFAULT_CONFIDENCE_THRESHOLD) |

## DO

- 새 포트 인터페이스 추가 시 ports/index.ts에서 export
  ```typescript
  export type { ParserPort } from './parser.js';
  export type { OcrPort, OcrResult, OcrRegion } from './ocr.js';
  export type { NewPort } from './new-port.js';
  ```

- 어댑터가 사용할 공통 예외 클래스 정의
  ```typescript
  export class InvalidFileFormatError extends Error { }
  export class ParseError extends Error { }
  ```

## DON'T

- 특정 파서/어댑터 직접 import하지 않기
