# Page Hashing 기반 증분 변환 설계

**Goal:** mtime 기반 변환/스킵을 페이지 해싱 기반으로 변경하여, 정확한 변경 감지와 페이지 단위 부분 업데이트를 지원한다.

**Architecture:** 2단계 해시 비교(파일 해시 → 페이지 해시)로 변경을 감지하고, Generator가 자기 포맷에 맞게 부분 교체를 수행하는 Generator 독립 방식(C). core는 변경된 페이지 목록만 전달하고, 각 Generator가 incrementalUpdate()를 구현한다.

## 결정 사항

### 변경 감지
- 1차: 원본 파일 바이너리의 SHA-1 해시(fileHash)로 빠른 스킵
- 2차: 파싱 후 각 Page.imageData의 SHA-1 해시(pageHashes)로 페이지 단위 diff

### 부분 업데이트 전략
| 상황 | 처리 |
|------|------|
| fileHash 동일 | 스킵 (파싱 안 함) |
| 모든 pageHash 동일 | 스킵 |
| 내용만 변경 (same ids, same order) | incrementalUpdate() |
| 끝에 페이지 추가 | incrementalUpdate() |
| 중간 삽입/삭제/재정렬 | generate() + unchanged OCR 재사용 |
| OCR 마커 추출 실패 | generate() + 전체 OCR 재실행 |
| 파서 변경 | generate() + 전체 OCR 재실행 |

### OCR 마커
- 양쪽 Generator 모두 `<!-- page: ${pageId} -->` 형식으로 통일
- 기존 Excalidraw: `<!-- Page ${pageIndex+1} -->` → `<!-- page: ${pageId} -->` 변경
- Markdown: 마커 새로 추가

### 메타데이터 저장
- frontmatter에 저장: fileHash, pageHashes (순서 보존 배열), parser id
- mtime 필드 제거

### 인터페이스 변경
- `ConversionMetadata`: mtime 제거, parser/fileHash/pageHashes 추가
- `ParserPort`: id 필드 추가 (생성자 주입)
- `FileGeneratorPort`: incrementalUpdate() 메서드 추가
- `FileChangeEvent`: mtime 필드 제거

### 해시 알고리즘
- SHA-1 (Web Crypto API) — Excalidraw fileId와 동일, 보안 목적 아닌 변경 감지용
