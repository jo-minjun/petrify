# Obsidian Plugin Design

## 개요

외부 폴더의 손글씨 파일(.note 등)을 감시하여 자동으로 Excalidraw 형식으로 변환하는 Obsidian 플러그인.

## 범위

### Phase 3 포함

- 외부 폴더 감시 (chokidar)
- 파일 변경 시 자동 변환
- OCR 통합

### Phase 3 제외 (향후)

- 드래그 & 드롭 (Phase 4)
- 다중 페이지 OCR (Phase 5)
- 삭제 동기화 (Phase 6)

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│            Obsidian Plugin                          │
│  ┌─────────────────┐                                │
│  │ PetrifyWatcher  │                                │
│  │ (chokidar)      │                                │
│  │ 외부폴더 감시    │                                │
│  └────────┬────────┘                                │
│           │                                         │
│           ▼                                         │
│  ┌─────────────────┐                                │
│  │   Converter     │                                │
│  │ (변환 오케스트레이션)                              │
│  └────────┬────────┘                                │
│           │                                         │
│           ▼                                         │
│  ┌─────────────────┐                                │
│  │ @petrify/core   │                                │
│  │ convertToMdWithOcr()                             │
│  └─────────────────┘                                │
└─────────────────────────────────────────────────────┘
```

## 설정 구조

```typescript
interface PetrifySettings {
  watchMappings: Array<{
    watchDir: string;    // 외부 폴더 경로
    outputDir: string;   // vault 내 출력 폴더
  }>;

  ocr: {
    provider: 'gutenye' | 'google-vision' | 'azure-ocr';
    confidenceThreshold: number;
    providerConfig: {
      googleVision?: { apiKey: string };
      azureOcr?: { apiKey: string; endpoint: string };
    };
  };
}
```

## 주요 결정사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 감시 폴더 | 여러 개, 각각 output 폴더 지정 | 유연한 폴더 매핑 |
| 저장 구조 | 플랫하게 | 사용자가 세분화 원하면 매핑 추가 |
| 파서 선택 | 확장자 기반 자동 감지 | ParserPort.extensions 활용 |
| 파일 충돌 | 덮어쓰기 | 원본 변경 시 재변환 자연스러움 |
| 변경 감지 | mtime 비교 | 단순하고 충분히 정확 |
| 알림 | 실패만 Notice | 성공은 파일 생성으로 확인 가능 |
| OCR | 항상 사용, Provider 선택 가능 | 핵심 기능 |
| API 키 저장 | Obsidian SecretStorage 활용 가능 | 보안 |
| Watcher 시작 | 플러그인 로드 시 자동 | 파일 동기화 도구 관례 |
| 초기 스캔 | 전체 스캔, mtime 비교 | 기존 파일도 변환 필요 |
| 에러 처리 | 파일별 독립, 실패해도 다음 진행 | 무결성 유지 |

## 변환 흐름

```
1. 플러그인 로드
   └── Watcher 자동 시작 (모든 watchMappings 대상)

2. 초기 스캔
   └── 각 watchDir의 모든 파일 순회
       └── 지원하는 확장자? (.note 등)
           └── 변환 파일 존재?
               ├── 없음 → 변환
               └── 있음 → mtime 비교
                   └── 원본이 더 최신 → 재변환

3. 파일 변경 감지 (chokidar)
   └── create/change 이벤트
       └── 지원하는 확장자?
           └── 변환 실행

4. 변환 실행
   ├── 확장자로 Parser 자동 선택
   ├── core.convertToMdWithOcr() 호출
   ├── frontmatter에 source, mtime 기록
   └── outputDir에 저장 (덮어쓰기)

5. 에러 발생 시
   └── Obsidian Notice로 알림
   └── 다음 파일 계속 진행
```

## 출력 파일 형식

**파일명:** `{원본파일명}.excalidraw.md`

**파일 내용:**
```markdown
---
petrify:
  source: /Users/me/GoogleDrive/Viwoods/meeting-notes.note
  mtime: 1705315800000
excalidraw-plugin: parsed
---

# Excalidraw Data
(ExcalidrawMdGenerator 출력)

## OCR Text
(OCR 결과)
```

## 에러 처리

| 에러 | 원인 | 처리 |
|------|------|------|
| 파서 없음 | 지원 안 하는 확장자 | 무시 (로그만) |
| 파싱 실패 | 손상된 파일 | Notice 알림, 해당 파일 스킵 |
| OCR 실패 | API 오류, 네트워크 | Notice 알림, 해당 파일 스킵 |
| 저장 실패 | 권한, 경로 문제 | Notice 알림, 해당 파일 스킵 |
| 감시 폴더 접근 불가 | 경로 오류, 권한 | Notice 알림, 해당 매핑 스킵 |

**핵심 원칙:**
- 출력 파일 무결성 유지 (중간 실패 시 저장 안 함)
- 단일 파일 실패가 전체 변환을 막지 않음

## 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `obsidian` | >=1.11.0 | Obsidian API |
| `chokidar` | ^5.0.0 | 파일 감시 |
| `@petrify/core` | workspace | 변환 로직 |
| `esbuild` | ^0.25.0 | 번들링 |

**최소 요구사항:**
- Obsidian: 1.11.0+
- Node.js: 20.19+
- 데스크톱만 지원 (chokidar가 Node.js 기반)

## 제한사항

- Obsidian 모바일: 미지원 (chokidar가 Node.js 기반)
- 외부 폴더 권한: 사용자가 직접 OS 권한 설정 필요
- 양방향 동기화: 미지원 예정
