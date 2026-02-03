# Petrify

다양한 필기 노트 앱 파일을 Obsidian Excalidraw로 변환

## 소개

Petrify는 여러 필기 노트 앱의 파일을 Obsidian에서 하나의 포맷(Excalidraw)으로 관리할 수 있도록 합니다.

**현재 지원:**
- Parser: viwoods (.note)
- OCR: @gutenye/ocr-browser (PaddleOCR 기반)

**계획 중:**
- Obsidian 플러그인
- Google Drive 파일 감지 및 동기화

어댑터 패턴을 사용하여 새로운 Parser나 OCR provider를 쉽게 추가할 수 있습니다. OCR 기능으로 손글씨를 텍스트로 추출하여 Obsidian에서 검색 가능하게 만듭니다.

## 지원 현황

| 구분 | 항목 | 상태 |
|------|------|------|
| Parser | viwoods (.note) | ✅ |
| Parser | supernote | ❌ |
| Parser | remarkable | ❌ |
| Parser | etc. | ❌ |
| OCR | @gutenye/ocr-browser | ✅ |
| OCR | etc. | ❌ |
| 기능 | Excalidraw 변환 | ✅ |
| 기능 | OCR 텍스트 추출 | ✅ |
| 기능 | Obsidian 플러그인 | ❌ |
| 기능 | Google Drive 동기화 | ❌ |

✅ 지원 | ❌ 미지원

## 아키텍처

```
                             ┌─────────────────────────────────────┐
                             │               @petrify/core         │
┌────────────────┐           │  ┌────────────┐    ┌────────────┐   │               ┌────────────────┐
│ Handwriting    │──▶ parser─│─▶│ ParserPort │───▶│  변환 로직   │───│──▶ output ───▶│ .excalidraw.md │
│ File           │           │  └────────────┘    └────────────┘   │               └────────────────┘
└────────────────┘           │                          ▲          │
                             │  ┌────────────┐          │          │
                             │  │  OcrPort   │──────────┘          │
                             │  └────────────┘                     │
                             └──────────▲──────────────────────────┘
                                        │
                                       ocr
                                        ▲
                                        ┆
                             ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                               Obsidian 플러그인
                             └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
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
pnpm add @petrify/ocr-gutenye
```

## 패키지 구조

```
packages/
├── core/                 # @petrify/core
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods
└── ocr/
    └── gutenye/          # @petrify/ocr-gutenye
```

### 의존성

```
parser ──▶ core ◀── ocr
```

## 라이선스

MIT
