# mainBmp 색상 추출 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** mainBmp 이미지에서 각 스트로크 좌표의 색상을 샘플링하여 펜 타입(볼펜/형광펜)과 색상을 자동으로 복원

**Architecture:** Parser가 path 데이터와 mainBmp를 함께 읽어서, 각 포인트 좌표에서 픽셀 색상을 추출하고, 연속된 동일 색상 포인트를 하나의 Stroke로 그룹화

**Tech Stack:** Python, Pillow (PIL)

---

## Task 1: ColorExtractor 클래스 생성

**Files:**
- Create: `src/petrify_converter/color_extractor.py`
- Test: `tests/test_color_extractor.py`

**Step 1: Write the failing test**

```python
# tests/test_color_extractor.py
from pathlib import Path
from PIL import Image
import io

from petrify_converter.color_extractor import ColorExtractor


def test_extract_color_at_point():
    """포인트 좌표에서 색상 추출."""
    # 10x10 빨간색 이미지 생성
    img = Image.new('RGBA', (10, 10), (255, 0, 0, 255))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    color, alpha = extractor.get_color_at(5, 5)

    assert color == "#ff0000"
    assert alpha == 255


def test_extract_color_transparent():
    """투명도 있는 색상 추출."""
    img = Image.new('RGBA', (10, 10), (0, 180, 250, 100))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    color, alpha = extractor.get_color_at(5, 5)

    assert color == "#00b4fa"
    assert alpha == 100


def test_classify_pen_type_black():
    """검정 볼펜 분류."""
    extractor = ColorExtractor.__new__(ColorExtractor)
    pen_type = extractor.classify_pen_type("#000000", 255)

    assert pen_type == "pen"


def test_classify_pen_type_highlighter():
    """형광펜 분류 (낮은 알파값)."""
    extractor = ColorExtractor.__new__(ColorExtractor)
    pen_type = extractor.classify_pen_type("#ff00bc", 76)

    assert pen_type == "highlighter"
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_color_extractor.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'petrify_converter.color_extractor'"

**Step 3: Write minimal implementation**

```python
# src/petrify_converter/color_extractor.py
from PIL import Image
import io


class ColorExtractor:
    """mainBmp 이미지에서 색상 추출."""

    ALPHA_THRESHOLD = 200  # 이 값 미만이면 형광펜으로 분류

    def __init__(self, image_data: bytes):
        self.image = Image.open(io.BytesIO(image_data)).convert('RGBA')
        self.pixels = self.image.load()
        self.width, self.height = self.image.size

    def get_color_at(self, x: int, y: int) -> tuple[str, int]:
        """좌표에서 색상과 알파값 추출.

        Returns:
            (hex_color, alpha) 튜플
        """
        if not (0 <= x < self.width and 0 <= y < self.height):
            return "#000000", 255

        r, g, b, a = self.pixels[x, y]
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        return hex_color, a

    def classify_pen_type(self, color: str, alpha: int) -> str:
        """색상과 알파값으로 펜 타입 분류.

        Returns:
            "pen" 또는 "highlighter"
        """
        if alpha < self.ALPHA_THRESHOLD:
            return "highlighter"
        return "pen"
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_color_extractor.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "feat: ColorExtractor 클래스 추가

mainBmp에서 좌표별 색상 추출 및 펜 타입 분류 기능

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Stroke 모델에 opacity 필드 추가

**Files:**
- Modify: `src/petrify_converter/models/stroke.py`
- Modify: `tests/models/test_stroke.py`

**Step 1: Write the failing test**

```python
# tests/models/test_stroke.py 에 추가
def test_stroke_with_opacity():
    """투명도가 있는 스트로크 생성."""
    points = [Point(0, 0, 1), Point(10, 10, 2)]
    stroke = Stroke(points=points, color="#ff00bc", width=5.0, opacity=50)

    assert stroke.opacity == 50


def test_stroke_default_opacity():
    """기본 투명도는 100."""
    points = [Point(0, 0, 1)]
    stroke = Stroke(points=points)

    assert stroke.opacity == 100
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/models/test_stroke.py::test_stroke_with_opacity -v`
Expected: FAIL with "TypeError: __init__() got an unexpected keyword argument 'opacity'"

**Step 3: Write minimal implementation**

```python
# src/petrify_converter/models/stroke.py - Stroke 클래스 수정
@dataclass
class Stroke:
    points: list[Point]
    color: str = "#000000"
    width: float = 1.0
    opacity: int = 100  # 0-100, 100이 불투명
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/models/test_stroke.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/models/stroke.py tests/models/test_stroke.py
git commit -m "feat: Stroke 모델에 opacity 필드 추가

형광펜 투명도 지원을 위한 필드 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: ColorExtractor에 스트로크 색상 추출 메서드 추가

**Files:**
- Modify: `src/petrify_converter/color_extractor.py`
- Modify: `tests/test_color_extractor.py`

**Step 1: Write the failing test**

```python
# tests/test_color_extractor.py 에 추가
def test_extract_stroke_color():
    """스트로크의 대표 색상 추출."""
    # 왼쪽 절반 빨강, 오른쪽 절반 파랑
    img = Image.new('RGBA', (20, 10), (255, 0, 0, 255))
    for x in range(10, 20):
        for y in range(10):
            img.putpixel((x, y), (0, 0, 255, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    # 빨간 영역 포인트들
    red_points = [[5, 5, 1], [6, 5, 2], [7, 5, 3]]
    color, alpha = extractor.extract_stroke_color(red_points)

    assert color == "#ff0000"
    assert alpha == 255
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_color_extractor.py::test_extract_stroke_color -v`
Expected: FAIL with "AttributeError: 'ColorExtractor' object has no attribute 'extract_stroke_color'"

**Step 3: Write minimal implementation**

```python
# src/petrify_converter/color_extractor.py 에 메서드 추가
from collections import Counter

def extract_stroke_color(self, points: list[list]) -> tuple[str, int]:
    """스트로크 포인트들의 대표 색상 추출.

    가장 많이 나타나는 색상을 반환 (배경색 제외).

    Args:
        points: [[x, y, timestamp], ...] 형식

    Returns:
        (hex_color, alpha) 튜플
    """
    colors = []
    for point in points:
        x, y = int(point[0]), int(point[1])
        color, alpha = self.get_color_at(x, y)

        # 흰색(배경) 제외
        if color.lower() not in ("#ffffff", "#fefefe", "#fdfdfd"):
            colors.append((color, alpha))

    if not colors:
        return "#000000", 255

    # 가장 많이 나타나는 색상
    color_counts = Counter(colors)
    most_common = color_counts.most_common(1)[0][0]
    return most_common
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_color_extractor.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "feat: ColorExtractor에 스트로크 대표 색상 추출 기능 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Parser에서 ColorExtractor 연동

**Files:**
- Modify: `src/petrify_converter/parser.py`
- Modify: `tests/test_parser.py`

**Step 1: Write the failing test**

```python
# tests/test_parser.py 에 추가
def test_parser_extracts_stroke_colors(examples_dir):
    """스트로크 색상이 mainBmp에서 추출됨."""
    # various_text 예시 사용
    various_text_dir = examples_dir.parent / "various_text" / "extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    parser = NoteParser(various_text_dir)
    note = parser.parse()

    # 색상이 추출되었는지 확인
    colors = set(stroke.color for page in note.pages for stroke in page.strokes)

    # 검정색 외에 다른 색상도 있어야 함
    assert len(colors) > 1
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_parser.py::test_parser_extracts_stroke_colors -v`
Expected: FAIL (모든 스트로크가 기본 검정색)

**Step 3: Write minimal implementation**

`parser.py`의 `_parse_strokes` 메서드 수정:

```python
# src/petrify_converter/parser.py
from petrify_converter.color_extractor import ColorExtractor

def _parse_strokes(self, path_file: Path, mainbmp_data: bytes | None) -> list[Stroke]:
    """스트로크 파싱 (mainBmp에서 색상 추출 포함)."""
    try:
        data = json.loads(path_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ParseError(f"Failed to parse stroke data: {e}")

    if not data:
        return []

    # mainBmp가 없으면 기본 색상으로 분리
    if mainbmp_data is None:
        return Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    # ColorExtractor로 색상 추출하며 스트로크 분리
    extractor = ColorExtractor(mainbmp_data)
    return self._split_strokes_with_color(data, extractor)

def _split_strokes_with_color(
    self, data: list[list], extractor: ColorExtractor
) -> list[Stroke]:
    """색상 정보를 포함하여 스트로크 분리."""
    from petrify_converter.models import Point

    if not data:
        return []

    sorted_data = sorted(data, key=lambda p: p[2])

    strokes = []
    current_points = []
    current_color = None
    current_alpha = None

    for point in sorted_data:
        x, y, ts = int(point[0]), int(point[1]), point[2]
        color, alpha = extractor.get_color_at(x, y)

        # 배경색이면 이전 색상 유지
        if color.lower() in ("#ffffff", "#fefefe", "#fdfdfd"):
            if current_color is not None:
                color, alpha = current_color, current_alpha

        # 색상이 바뀌거나 timestamp gap이 크면 새 스트로크
        if current_points:
            prev_ts = current_points[-1][2]
            color_changed = (current_color != color)
            gap_large = (ts - prev_ts >= 6)

            if color_changed or gap_large:
                # 현재 스트로크 저장
                stroke_color = current_color or "#000000"
                stroke_alpha = current_alpha or 255
                opacity = int(stroke_alpha / 255 * 100)

                points = [Point.from_list(p) for p in current_points]
                strokes.append(Stroke(
                    points=points,
                    color=stroke_color,
                    opacity=opacity
                ))
                current_points = []

        current_points.append(point)
        current_color = color
        current_alpha = alpha

    # 마지막 스트로크
    if current_points:
        stroke_color = current_color or "#000000"
        stroke_alpha = current_alpha or 255
        opacity = int(stroke_alpha / 255 * 100)

        points = [Point.from_list(p) for p in current_points]
        strokes.append(Stroke(
            points=points,
            color=stroke_color,
            opacity=opacity
        ))

    return strokes
```

`_parse_pages` 메서드도 수정하여 mainbmp_data를 전달:

```python
def _parse_pages(self) -> list[Page]:
    """페이지 파싱."""
    path_files = self._find_path_files()
    path_to_mainbmp = self._parse_page_resource()
    mainbmp_files = self._find_mainbmp_files()
    pages = []

    for path_file in path_files:
        page_id = path_file.stem.replace("path_", "")

        background_image = self._load_mainbmp(
            page_id, path_to_mainbmp, mainbmp_files
        )

        strokes = self._parse_strokes(path_file, background_image)

        page = Page(
            id=page_id,
            strokes=strokes,
            background_image=background_image,
        )
        pages.append(page)

    return pages if pages else [Page(id="empty", strokes=[])]
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_parser.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/parser.py tests/test_parser.py
git commit -m "feat: Parser에서 mainBmp 색상 추출 연동

스트로크 분리 시 mainBmp에서 픽셀 색상을 샘플링하여
각 스트로크의 색상과 투명도를 자동으로 설정

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: ExcalidrawGenerator에서 opacity 반영

**Files:**
- Modify: `src/petrify_converter/excalidraw.py`
- Modify: `tests/test_excalidraw.py`

**Step 1: Write the failing test**

```python
# tests/test_excalidraw.py 에 추가
def test_freedraw_with_opacity():
    """투명도가 있는 freedraw 요소 생성."""
    points = [Point(0, 0, 1), Point(10, 10, 2)]
    stroke = Stroke(points=points, color="#ff00bc", opacity=50)

    generator = ExcalidrawGenerator()
    element = generator.create_freedraw(stroke, 0, 0)

    assert element["strokeColor"] == "#ff00bc"
    assert element["opacity"] == 50
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_excalidraw.py::test_freedraw_with_opacity -v`
Expected: FAIL (opacity가 항상 100)

**Step 3: Write minimal implementation**

`excalidraw.py`의 `create_freedraw` 메서드에서 opacity 반영:

```python
def create_freedraw(
    self, stroke: Stroke, x_offset: float, y_offset: float
) -> dict[str, Any]:
    """Stroke를 freedraw 요소로 변환."""
    if not stroke.points:
        return self._empty_freedraw(x_offset, y_offset, stroke)

    first_point = stroke.points[0]
    points = [[p.x - first_point.x, p.y - first_point.y] for p in stroke.points]

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    width = max(xs) - min(xs) if xs else 0
    height = max(ys) - min(ys) if ys else 0

    return {
        "type": "freedraw",
        "id": self._generate_id(),
        "x": first_point.x + x_offset,
        "y": first_point.y + y_offset,
        "width": width,
        "height": height,
        "strokeColor": stroke.color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": int(stroke.width),
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": stroke.opacity,  # 여기 수정
        "angle": 0,
        "points": points,
        "pressures": [],
        "simulatePressure": True,
        "seed": self._generate_seed(),
        "version": 1,
        "versionNonce": self._generate_seed(),
        "isDeleted": False,
        "groupIds": [],
        "frameId": None,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False,
    }
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_excalidraw.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "feat: ExcalidrawGenerator에서 stroke.opacity 반영

형광펜 투명도가 Excalidraw freedraw 요소에 적용됨

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 통합 테스트 및 검증

**Files:**
- Modify: `tests/test_integration.py`

**Step 1: Write the failing test**

```python
# tests/test_integration.py 에 추가
def test_various_text_color_extraction(tmp_path):
    """various_text 예시에서 색상이 올바르게 추출됨."""
    various_text_dir = Path("examples/various_text/extracted")
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    output_path = tmp_path / "various_text_output.excalidraw.md"
    convert(various_text_dir, output_path)

    # 출력 파일 파싱
    with open(output_path) as f:
        content = f.read()

    # 형광펜 색상이 포함되어 있는지 확인
    assert "#ff00bc" in content.lower() or "#00b4fa" in content.lower()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_integration.py::test_various_text_color_extraction -v`
Expected: FAIL (색상이 모두 #000000)

**Step 3: 이미 구현됨 (Task 1-5 완료 시 통과)**

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_integration.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: various_text 색상 추출 통합 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: pyproject.toml에 pillow 의존성 추가

**Files:**
- Modify: `pyproject.toml`

**Step 1: 의존성 확인**

Run: `grep pillow pyproject.toml`
Expected: 없음

**Step 2: pillow 추가**

```toml
# pyproject.toml의 dependencies 섹션에 추가
dependencies = [
    "lzstring",
    "pillow>=10.0.0",
]
```

**Step 3: 설치 확인**

Run: `pip install -e . && python -c "from PIL import Image; print('OK')"`
Expected: OK

**Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "chore: pillow 의존성 추가

mainBmp 이미지 처리를 위한 Pillow 라이브러리 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 완료 후 검증

```bash
# 전체 테스트 실행
pytest -v

# various_text 변환 테스트
python -c "
from petrify_converter import convert
convert(
    'examples/various_text/extracted',
    '/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_color.excalidraw.md'
)
print('변환 완료')
"
```

Obsidian에서 `various_text_color.excalidraw.md`를 열어서:
1. 검정 볼펜 스트로크가 검정색으로 표시되는지
2. 형광펜 스트로크가 해당 색상과 투명도로 표시되는지 확인
