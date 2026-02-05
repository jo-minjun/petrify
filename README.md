# Petrify

다양한 필기 노트 앱 파일을 Obsidian Excalidraw로 변환

## 소개

Petrify는 여러 필기 노트 앱의 파일을 Obsidian에서 하나의 포맷(Excalidraw)으로 관리할 수 있도록 합니다.

**현재 지원:**
- Parser: viwoods (.note)
- OCR: Tesseract.js
- Watcher: chokidar (로컬 파일시스템)
- Obsidian 플러그인 (외부 폴더 감시 → 자동 변환)

**계획 중:**
- Obsidian Vault 내부 파일 감시 (VaultWatcher)

포트/어댑터 패턴으로 Parser, OCR, Watcher를 독립적으로 확장할 수 있습니다. OCR 기능으로 손글씨를 텍스트로 추출하여 Obsidian에서 검색 가능하게 만듭니다.

## 지원 현황

| 구분 | 항목 | 상태 |
|------|------|------|
| Parser | viwoods (.note) | ✅ |
| Parser | supernote | ❌ |
| Parser | remarkable | ❌ |
| Parser | etc. | ❌ |
| OCR | Tesseract.js | ✅ |
| OCR | etc. | ❌ |
| Watcher | chokidar (로컬 FS) | ✅ |
| Watcher | Obsidian Vault | ❌ |
| 기능 | Excalidraw 변환 | ✅ |
| 기능 | OCR 텍스트 추출 | ✅ |
| 기능 | Obsidian 플러그인 | ✅ |

✅ 지원 | ❌ 미지원

## 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                         @petrify/core                        │
│                                                              │
│  ┌────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐ │
│  │ ParserPort │ │ OcrPort  │ │WatcherPort│ │Conversion    │ │
│  └─────┬──────┘ └─────┬────┘ └─────┬─────┘ │  StatePort   │ │
│        │              │            │        └──────┬───────┘ │
│        ▼              ▼            ▼               ▼         │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                 ConversionPipeline                    │   │
│  │  filter ext -> check mtime -> parse -> ocr -> convert │   │
│  └──────────────────────┬────────────────────────────────┘   │
└─────────────────────────┼────────────────────────────────────┘
                          │
         implements       │               implements
   ┌──────────────────────┼───────────────────────────┐
   │           │          │          │                 │
   ▼           ▼          ▼          ▼                 ▼
┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐
│ parser │ │   ocr    │ │watcher │ │ Frontmatter │
│viwoods │ │tesseract │ │chokidar│ │ Conversion  │
│        │ │          │ │        │ │    State    │
└────────┘ └──────────┘ └────────┘ └─────────────┘
                                    └ obsidian-plugin ┘
                          │
                          ▼
                  ┌────────────────┐
                  │ .excalidraw.md │
                  │(Obsidian Vault)│
                  └────────────────┘
```

## 설치

### 요구사항

- Node.js 20+
- pnpm

### 개발 환경

```bash
pnpm install
pnpm build
pnpm test
```

### 패키지 개별 설치

```bash
pnpm add @petrify/core
pnpm add @petrify/parser-viwoods
pnpm add @petrify/ocr-tesseract
pnpm add @petrify/watcher-chokidar
```

## Obsidian 플러그인

외부 폴더의 필기 노트 파일을 감시하여 Obsidian vault에 Excalidraw 형식으로 자동 변환합니다.

### 기능

- **파일 감시**: WatcherPort 기반 실시간 파일 변경 감지 (현재 chokidar 어댑터)
- **다중 폴더 매핑**: 여러 외부 폴더를 각각 다른 vault 폴더로 매핑
- **자동 변환**: ConversionPipeline이 확장자 필터링 → mtime 스킵 → 변환 자동 처리
- **OCR 지원**: 손글씨 텍스트 추출 (Tesseract.js)
- **중복 방지**: ConversionStatePort 기반 mtime 비교로 이미 변환된 파일 재처리 안함

### 설정

| 항목 | 설명 |
|------|------|
| Watch Directories | 감시할 외부 폴더 경로 (다중 설정 가능) |
| Output Directories | 변환된 파일이 저장될 vault 내 경로 (매핑별 지정) |
| Confidence Threshold | OCR 신뢰도 임계값 (0-100) |

### Google Drive 연동

Google Drive for Desktop으로 로컬 동기화된 폴더를 Watch Directory로 지정하면 자동 변환이 동작합니다.

1. [Google Drive for Desktop](https://www.google.com/drive/download/) 설치
2. 필기 노트 파일이 있는 Google Drive 폴더를 로컬 동기화 설정
3. Petrify 설정의 Watch Directory에 동기화된 로컬 경로를 지정
   - macOS: `~/Library/CloudStorage/GoogleDrive-<계정>/My Drive/<폴더>`
   - Windows: `G:\My Drive\<폴더>` (드라이브 문자는 설정에 따라 다름)

### 요구사항

- Obsidian 1.11.0+
- Desktop only (Node.js 파일 시스템 접근 필요)

## 패키지 구조

```
packages/
├── core/                 # @petrify/core (포트 인터페이스 + ConversionPipeline)
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods (ParserPort 구현)
├── ocr/
│   └── tesseract/        # @petrify/ocr-tesseract (OcrPort 구현)
├── watcher/
│   └── chokidar/         # @petrify/watcher-chokidar (WatcherPort 구현)
└── obsidian-plugin/      # Obsidian 플러그인 (조립 + UI)
```

### 의존성

```
                    ┌─────────────────────┐
                    │  obsidian-plugin    │
                    └─────────┬───────────┘
                              │
        ┌──────────┬──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐
   │ parser  │ │   ocr    │ │ watcher │ │         │
   │ viwoods │ │tesseract │ │chokidar │ │  core   │
   └────┬────┘ └────┬─────┘ └────┬────┘ └─────────┘
        │           │           │           ▲
        └───────────┴───────────┴───────────┘
```

## 라이선스

MIT
