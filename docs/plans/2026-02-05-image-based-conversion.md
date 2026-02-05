# 이미지 기반 변환 전략 전환

## 배경

벡터 파싱 전략의 기술적 한계:
- Viwoods가 펜 압력, 펜 종류 등 충분한 데이터를 제공하지 않음
- ColorExtractor 등 복잡한 휴리스틱으로 한계를 커버하려 했으나, 공수 대비 품질이 부족
- 원본 충실도를 벡터로 재현하는 것이 사실상 불가능

## 목표

- 원본 노트가 Obsidian에서 원본과 최대한 동일하게 보일 것
- Excalidraw 위에 추가 주석/드로잉이 가능할 것
- OCR 텍스트 검색은 유지할 것

## 핵심 결정

- **벡터 파싱 → 이미지 임베딩으로 전면 전환** (점진적 전환 아님)
- 소스: `.note` ZIP 내 `screenshotBmp_{pageId}.png` (배경 포함, 원본에 가장 가까움)
- 포맷: PNG (Excalidraw 네이티브 지원, PDF는 미지원)
- 레이아웃: 모든 페이지를 하나의 `.excalidraw.md`에 image 요소로 세로 나열

## 새 변환 파이프라인

```
.note ZIP
  ↓ ViwoodsParser (리팩토링)
  ├─ NoteFileInfo.json → title, dates
  ├─ PageListFileInfo.json → 페이지 순서 (order)
  └─ screenshotBmp_{pageId}.png × N → 페이지별 PNG 바이너리
  ↓
Note { title, pages: Page[], createdAt, modifiedAt }
Page { id, imageData: Uint8Array, width, height, order }
  ↓ ExcalidrawGenerator (리팩토링)
  ├─ 페이지별 image element (세로 나열, 100px gap)
  └─ files 객체에 base64 PNG 임베딩
  ↓ OCR (screenshotBmp → Tesseract 직접 전달)
  ├─ StrokeRenderer 불필요 (이미 PNG)
  └─ 페이지별 텍스트 추출 (다중 페이지 OCR 자연스럽게 해결)
  ↓ ExcalidrawMdGenerator
  └─ .excalidraw.md (OCR 텍스트 + 압축 Excalidraw JSON)
```

## 모델 변경

### 현재

```typescript
Page { id, strokes: Stroke[], width, height }
Stroke { points: Point[], color, width, opacity }
Point { x, y, timestamp }
```

### 변경 후

```typescript
Page { id, imageData: Uint8Array, width, height, order }
```

`Stroke`, `Point`, `StrokeStyle` 삭제. Page가 이미지 바이너리를 직접 보유.

## Excalidraw 이미지 임베딩 구조

```typescript
// elements 배열
{
  type: "image",
  fileId: "abc123",
  x: 0, y: pageIndex * (1920 + 100),
  width: 1440,
  height: 1920,
}

// files 객체
{
  "abc123": {
    mimeType: "image/png",
    id: "abc123",
    dataURL: "data:image/png;base64,iVBOR...",
    created: 1234567890
  }
}
```

## OCR 변경

- 기존: `Stroke[] → StrokeRenderer (Canvas) → PNG → Tesseract`
- 변경: `Page.imageData (이미 PNG) → Tesseract`
- StrokeRenderer 완전 제거
- 다중 페이지 OCR이 자연스럽게 해결됨 (페이지별 개별 PNG 존재)

## 패키지별 변경 범위

| 패키지 | 제거 | 변경 |
|--------|------|------|
| `@petrify/core` | `Stroke`, `Point`, `StrokeStyle` 모델, `StrokeRenderer`, freedraw 생성 로직 | `Page` 모델, `ExcalidrawGenerator`, `ExcalidrawMdGenerator`, `ConversionPipeline` |
| `@petrify/parser-viwoods` | `ColorExtractor` 전체, path*.json 파싱 로직 | `NoteParser` (screenshotBmp 추출, PageListFileInfo 파싱 추가) |
| `@petrify/ocr-tesseract` | 없음 | 없음 (입력이 PNG인 건 동일) |
| `@petrify/watcher-chokidar` | 없음 | 없음 |
| `@petrify/obsidian-plugin` | 없음 | ConversionPipeline 호출 부분 (모델 변경에 따른 수정) |

## 파일 크기 예측

- 15페이지 screenshotBmp 합계: ~2.9MB
- base64 인코딩 후: ~3.9MB
- LZ-String 압축: 이미지 base64는 엔트로피가 높아 압축률 낮음
- 최종 `.excalidraw.md` 예상: ~4-5MB

## 미해결: 파일 크기 대응 전략

페이지가 많은 노트에서 성능 이슈 가능. 향후 대응 방안:
- 이미지 리사이즈 옵션 (1440x1920 → 720x960 등)
- N페이지 초과 시 파일 분할
- Obsidian Sync 5MB/파일 제한 고려 필요
