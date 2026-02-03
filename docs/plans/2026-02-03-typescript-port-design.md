# petrify TypeScript 포팅 설계

## 개요

petrify-converter를 Python에서 TypeScript로 완전 전환한다. Obsidian 플러그인에서 사용하기 위해 브라우저 환경을 타겟으로 한다.

## 핵심 결정사항

| 항목 | 결정 |
|------|------|
| 타겟 환경 | 브라우저 (Obsidian = Electron) |
| 언어 | TypeScript |
| 입력 형태 | ArrayBuffer |
| 출력 형태 | 객체 반환 → 직렬화 (Python 구조 유지) |
| 저장소 | Python 완전 대체 (같은 저장소) |

## 프로젝트 구조

```
petrify/
├── src/
│   ├── index.ts              # 공개 API (convert 함수)
│   ├── parser.ts             # NoteParser - ZIP 파싱
│   ├── color-extractor.ts    # ColorExtractor - 이미지에서 색상/굵기 추출
│   ├── excalidraw.ts         # ExcalidrawGenerator
│   ├── excalidraw-md.ts      # ExcalidrawMdGenerator
│   └── models/
│       ├── note.ts
│       ├── page.ts
│       └── stroke.ts
├── tests/                    # 테스트 (기존 Python 테스트 구조 유지)
├── examples/                 # 기존 샘플 데이터 유지
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 의존성

- `jszip` - ZIP 파일 처리
- `lz-string` - .excalidraw.md 압축
- 이미지 처리는 Canvas API 사용 (별도 의존성 불필요)

**개발 의존성:**
- `vitest` - 테스트
- `tsup` 또는 `esbuild` - 번들링
- `typescript`

## 핵심 타입

```typescript
// models/stroke.ts
interface Point {
  x: number;
  y: number;
  timestamp: number;
}

interface Stroke {
  points: Point[];
  color: string;      // hex (예: "#000000")
  opacity: number;    // 0-1
  width: number;      // 픽셀 단위 굵기
}

// models/page.ts
interface Page {
  id: string;
  strokes: Stroke[];
  width: number;      // 1440
  height: number;     // 1920
}

// models/note.ts
interface Note {
  title: string;
  pages: Page[];
  createdAt: Date;
  modifiedAt: Date;
}

// excalidraw.ts
interface ExcalidrawData {
  type: "excalidraw";
  version: number;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}
```

## 핵심 API

```typescript
// parser.ts
class NoteParser {
  async parse(data: ArrayBuffer): Promise<Note>
}

// color-extractor.ts
class ColorExtractor {
  constructor(imageData: ImageData)
  static async fromPng(pngData: ArrayBuffer): Promise<ColorExtractor>
  getColorAt(x: number, y: number): { color: string; opacity: number }
  getWidthAt(x: number, y: number): number
  extractStrokeWidth(points: Point[]): number
}

// excalidraw.ts
class ExcalidrawGenerator {
  generate(note: Note): ExcalidrawData
}

// excalidraw-md.ts
class ExcalidrawMdGenerator {
  generate(data: ExcalidrawData): string
}

// index.ts - 공개 API
async function convert(data: ArrayBuffer): Promise<ExcalidrawData>
async function convertToMd(data: ArrayBuffer): Promise<string>
```

**Python과의 차이점:**
- `NoteParser.parse()`가 `async` - ZIP 압축 해제가 비동기
- `ColorExtractor`는 Canvas API로 얻은 `ImageData` 사용

## 이미지 처리 (Canvas API)

Python의 Pillow 대신 브라우저 Canvas API 사용:

```typescript
class ColorExtractor {
  private imageData: ImageData;

  static async fromPng(pngData: ArrayBuffer): Promise<ColorExtractor> {
    const blob = new Blob([pngData], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return new ColorExtractor(imageData);
  }

  getColorAt(x: number, y: number): { color: string; opacity: number } {
    const idx = (y * this.imageData.width + x) * 4;
    const r = this.imageData.data[idx];
    const g = this.imageData.data[idx + 1];
    const b = this.imageData.data[idx + 2];
    const a = this.imageData.data[idx + 3];
    // hex 변환 및 opacity 계산
  }
}
```

`OffscreenCanvas`는 웹 워커에서도 사용 가능하고, Electron(Obsidian)에서 지원됨.

## 테스트 전략

기존 Python 테스트를 TypeScript로 포팅:

```typescript
describe('NoteParser', () => {
  it('ZIP 파일을 파싱한다', async () => {
    const data = await readFile('examples/normal/normal.note');
    const note = await new NoteParser().parse(data);

    expect(note.pages).toHaveLength(1);
    expect(note.pages[0].strokes.length).toBeGreaterThan(0);
  });
});
```

**테스트 데이터:**
- `examples/` 폴더의 기존 샘플 파일 그대로 사용
- 브라우저 환경 테스트를 위해 Vitest의 browser 모드 또는 happy-dom 사용

**단위 테스트 vs 통합 테스트:**
- 단위: 각 클래스별 (ColorExtractor, Stroke 분리 로직 등)
- 통합: 전체 파이프라인 (ArrayBuffer → .excalidraw.md)

## 마이그레이션 계획

### 1단계: TypeScript 프로젝트 설정
- `package.json`, `tsconfig.json`, `vitest.config.ts` 생성
- 의존성 설치 (jszip, lz-string)

### 2단계: 모델 포팅
- `models/stroke.ts`, `page.ts`, `note.ts`
- 가장 단순한 부분부터 시작

### 3단계: ColorExtractor 포팅
- Canvas API 기반으로 재구현
- 기존 Python 로직(4방향 측정, outlier 필터링) 유지

### 4단계: NoteParser 포팅
- JSZip으로 ZIP 처리
- JSON 파싱, 스트로크 분리 로직 포팅

### 5단계: Excalidraw 생성기 포팅
- ExcalidrawGenerator, ExcalidrawMdGenerator

### 6단계: 테스트 포팅 및 검증
- 기존 테스트 케이스를 TypeScript로 변환
- examples/ 샘플로 결과 비교

### 7단계: Python 코드 제거
- `src/petrify_converter/`, `tests/` (Python) 삭제
- `pyproject.toml`, `uv.lock` 삭제
