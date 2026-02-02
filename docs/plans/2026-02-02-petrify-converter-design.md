# Petrify Converter 설계

viwoods note 파일을 Excalidraw 포맷으로 변환하는 Python 라이브러리

## 배경

**petrify 프로젝트의 최종 목표**: viwoods aipaper의 note를 옵시디언에 동기화하고 관리

```
petrify
├── petrify-converter    ← 본 프로젝트 (note → Excalidraw 변환)
├── 동기화 모듈          ← 향후
└── 옵시디언 통합        ← 향후
```

Excalidraw 포맷을 선택한 이유: 옵시디언의 Excalidraw 플러그인과 호환

## 개요

- **프로젝트명**: petrify-converter
- **언어**: Python
- **형식**: 라이브러리 (로컬 사용)
- **입력**: viwoods aipaper mini의 `.note` 파일
- **출력**: `.excalidraw` 파일

## Note 파일 구조

`.note` 파일은 zip 압축 포맷이며, 다음 파일들을 포함:

| 파일 | 용도 |
|------|------|
| `*_NoteFileInfo.json` | 노트 메타데이터 (제목, 생성시간 등) |
| `*_PageListFileInfo.json` | 페이지 목록 |
| `*_PageResource.json` | 페이지 리소스 정보 |
| `path_*.json` | 스트로크 데이터 `[[x, y, timestamp], ...]` |
| `mainBmp_*.png` | 배경 이미지 |
| `screenshotBmp_*.png` | 스크린샷 |
| `Thumbnail_*.png` | 썸네일 |

## 변환 규칙

### 스트로크 변환
- Excalidraw의 `freedraw` 타입으로 변환
- 기본 색상: `#000000`
- 기본 굵기: `1px`
- 옵션으로 색상/굵기 지정 가능

### 다중 페이지 처리
- 하나의 Excalidraw 파일로 합침
- 페이지들을 세로로 배치
- 페이지 간 간격: 100px

### 배경 이미지
- 기본: 포함하지 않음
- `include_background=True` 옵션으로 포함 가능

## 프로젝트 구조

```
petrify-converter/
├── src/
│   └── petrify_converter/
│       ├── __init__.py          # 공개 API
│       ├── parser.py            # note 파일 파싱
│       ├── converter.py         # Excalidraw 변환 로직
│       ├── excalidraw.py        # Excalidraw 포맷 생성
│       ├── exceptions.py        # 커스텀 예외
│       └── models/
│           ├── __init__.py      # 모델 export
│           ├── stroke.py        # Point, Stroke
│           ├── page.py          # Page
│           └── note.py          # Note
├── examples/                    # 예시 note 파일
├── tests/
├── pyproject.toml
└── README.md
```

## 데이터 모델

### Point
```python
@dataclass
class Point:
    x: float
    y: float
    timestamp: int
```

### Stroke
```python
@dataclass
class Stroke:
    points: list[Point]
    color: str = "#000000"
    width: float = 1.0
```

### Page
```python
@dataclass
class Page:
    id: str
    strokes: list[Stroke]
    width: float = 1440.0
    height: float = 1920.0
    background_image: bytes | None = None
```

### Note
```python
@dataclass
class Note:
    title: str
    pages: list[Page]
    created_at: datetime
    modified_at: datetime
```

## 공개 API

```python
from petrify_converter import convert

# 기본 사용
convert("input.note", "output.excalidraw")

# 옵션 지정
convert(
    "input.note",
    "output.excalidraw",
    include_background=True,
    stroke_color="#000000",
    stroke_width=1
)
```

## 에러 처리

```python
from petrify_converter import convert
from petrify_converter.exceptions import InvalidNoteFileError

try:
    convert("input.note", "output.excalidraw")
except FileNotFoundError:
    print("파일을 찾을 수 없습니다")
except InvalidNoteFileError as e:
    print(f"유효하지 않은 note 파일: {e}")
```

### 예외 종류
- `InvalidNoteFileError`: 유효하지 않은 note 파일 (zip이 아니거나 필수 파일 누락)
- `ParseError`: path_*.json 파싱 실패

## 향후 확장

- 펜 색상/굵기 정보가 note 파일에서 발견되면 추출 로직 추가
- PyPI 배포
- CLI 도구 제공
