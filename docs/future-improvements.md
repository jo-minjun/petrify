# 향후 개선 과제

코드 변경이 크거나 별도 논의가 필요하여 별도 작업으로 분리한 항목들.

---

## 1. PetrifyService 에러 처리 전략 수립 ✅

### 배경

PetrifyService 자체는 에러를 catch하지 않고 호출자에게 전파한다. 플러그인 레이어에서 catch하지만 "Conversion failed"라는 일반 메시지만 제공한다. 사용자가 **왜** 변환이 실패했는지 알 수 없다.

### 완료된 작업

- [x] `ConversionError` 예외 클래스 추가 (`packages/core/src/exceptions.ts`)
  - `phase` 필드로 실패 단계 구분: `'parse' | 'ocr' | 'generate' | 'save'`
  - `cause` 필드에 원본 에러 보존
- [x] `PetrifyService.convertData()`에 try-catch 추가
  - `InvalidFileFormatError`, `ParseError` → `ConversionError { phase: 'parse' }`
  - `OcrInitializationError`, `OcrRecognitionError` → `ConversionError { phase: 'ocr' }`
  - generator 에러 → `ConversionError { phase: 'generate' }`
- [x] `PetrifyService.saveOutput()`에 try-catch 추가
  - 파일시스템 에러 → `ConversionError { phase: 'save' }`
- [x] 플러그인 catch 블록에서 `ConversionError.phase` 기반 사용자 메시지 분기
  - watcher, drop-handler, sync 모두 적용

---

## 2. PetrifyService 통합 테스트 보강 ✅

### 배경

현재 `petrify-service.test.ts`는 5개 테스트로, **스킵 조건**(미지원 확장자, 이전 mtime, 삭제 판단)만 검증한다. 실제 변환 플로우(parse → OCR → generate → save)를 거치는 테스트가 없다.

### 완료된 작업

- [x] **happy path: OCR 없이 변환** — writeFile 호출, outputPath 형식, formatMetadata 인자 검증
- [x] **happy path: OCR 포함 변환** — ocrResults 전달 검증
- [x] **OCR confidence 필터링** — threshold 이하 결과 필터링 검증
- [x] **에셋 포함 변환** — writeAsset 호출 횟수 및 경로 검증
- [x] **convertDroppedFile 플로우** — keep: true, source: null 메타데이터 검증
- [x] **에러 전파: parse** → ConversionError { phase: 'parse' }
- [x] **에러 전파: OCR** → ConversionError { phase: 'ocr' }
- [x] **에러 전파: save** → ConversionError { phase: 'save' }

테스트: 5개 → 13개 (8개 추가)

---

## 3. obsidian-plugin main.ts 테스트 ✅

### 배경

플러그인 테스트는 유틸리티(logger, settings, frontmatter)만 커버한다. `main.ts`의 핵심 로직(라이프사이클, 워처 등록, sync, 에러 처리)은 테스트가 없다.

### 완료된 작업 (방법 B: 핵심 로직 추출)

- [x] `SyncOrchestrator` 클래스 추출 (`packages/obsidian-plugin/src/sync-orchestrator.ts`)
  - `SyncFileSystem`, `VaultOperations` 인터페이스로 외부 의존성 추상화
  - main.ts의 syncAll() 로직을 이 클래스로 이동
  - `SyncResult` 반환으로 결과 구조화
- [x] main.ts 리팩토링 — SyncOrchestrator에 위임
  - isSyncing 플래그, ribbonIcon 관리는 main.ts에 유지
- [x] SyncOrchestrator 단위 테스트 18개 작성
  - 정상 sync, 디렉토리 읽기 실패, stat 실패
  - 변환 실패 (ConversionError), 이미 변환된 파일 스킵
  - orphan 정리, keep=true 보호, 비활성 매핑 스킵
  - 알 수 없는 파서, 미지원 확장자 무시

테스트: 26개 → 39개 (18개 추가, logger 1개 감소는 기존)

---

## 4. FileSystem 예외 클래스 추가 ✅

### 배경

`FileSystemPort` 구현체(`ObsidianFileSystemAdapter`)는 에러를 catch하지 않는다. Obsidian API의 원시 에러가 그대로 전파되며, 호출자는 파일 쓰기 실패인지 디렉토리 생성 실패인지 구분할 수 없다.

### 완료된 작업

- [x] `FileSystemError` 예외 클래스 추가 (`packages/core/src/exceptions.ts`)
  - `operation` 필드: `'read' | 'write' | 'mkdir' | 'delete' | 'stat'`
  - `path` 필드: 실패한 경로
  - `cause` 필드: 원본 에러
- [x] `ObsidianFileSystemAdapter` 각 메서드에 try-catch 추가
  - `writeFile()`: `FileSystemError { operation: 'write', path }`
  - `writeAsset()`: `FileSystemError { operation: 'write', path: assetPath }`
  - `exists()`: 실패 시 `false` 반환 (선택적 데이터)
- [x] `PetrifyService.saveOutput()`에서 `FileSystemError` → `ConversionError { phase: 'save' }` 변환 연결
