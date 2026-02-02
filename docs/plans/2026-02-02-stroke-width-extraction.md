# 스트로크 굵기 추출 및 배경 이미지 제거 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** mainBmp에서 스트로크 굵기를 추출하고, 불필요한 배경 이미지 기능 제거

**Architecture:** ColorExtractor에 굵기 측정 기능 추가 (4방향 단순 측정, alpha > 0 기준), Parser에서 굵기 추출 연동, 배경 이미지 관련 코드 전면 제거

**Tech Stack:** Python, Pillow (PIL), statistics (median)

---

## Task 1: ColorExtractor에 get_width_at 메서드 추가

**Files:**
- Modify: `src/petrify_converter/color_extractor.py`
- Modify: `tests/test_color_extractor.py`

**Step 1: Write the failing test**

```python
# tests/test_color_extractor.py 에 추가
def test_get_width_at_basic():
    """포인트에서 스트로크 굵기 측정."""
    # 10x10 이미지, 중앙에 5px 굵기의 수직선
    img = Image.new('RGBA', (10, 10), (0, 0, 0, 0))  # 투명 배경
    for y in range(10):
        for x in range(3, 8):  # 5px 굵기
            img.putpixel((x, y), (0, 0, 0, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    width = extractor.get_width_at(5, 5)

    assert width == 5


def test_get_width_at_transparent():
    """투명 픽셀에서는 0 반환."""
    img = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    width = extractor.get_width_at(5, 5)

    assert width == 0


def test_get_width_at_out_of_bounds():
    """범위 벗어나면 0 반환."""
    img = Image.new('RGBA', (10, 10), (255, 0, 0, 255))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    assert extractor.get_width_at(-1, 5) == 0
    assert extractor.get_width_at(5, 100) == 0
```

**Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py::test_get_width_at_basic -v`
Expected: FAIL with "AttributeError: 'ColorExtractor' object has no attribute 'get_width_at'"

**Step 3: Write minimal implementation**

```python
# src/petrify_converter/color_extractor.py 에 메서드 추가
def get_width_at(self, x: int, y: int) -> int:
    """포인트에서 스트로크 굵기 측정 (4방향, alpha > 0 기준).

    Returns:
        굵기 (px). 투명이거나 범위 벗어나면 0.
    """
    if not (0 <= x < self.width and 0 <= y < self.height):
        return 0

    if self.pixels[x, y][3] == 0:  # 투명
        return 0

    # 수직 측정
    v_width = 1
    for dy in [-1, 1]:
        cy = y + dy
        while 0 <= cy < self.height and self.pixels[x, cy][3] > 0:
            v_width += 1
            cy += dy

    # 수평 측정
    h_width = 1
    for dx in [-1, 1]:
        cx = x + dx
        while 0 <= cx < self.width and self.pixels[cx, y][3] > 0:
            h_width += 1
            cx += dx

    return min(v_width, h_width)
```

**Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "feat: ColorExtractor에 get_width_at 메서드 추가

4방향 측정으로 스트로크 굵기 계산

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: ColorExtractor에 extract_stroke_width 메서드 추가

**Files:**
- Modify: `src/petrify_converter/color_extractor.py`
- Modify: `tests/test_color_extractor.py`

**Step 1: Write the failing test**

```python
# tests/test_color_extractor.py 에 추가
def test_extract_stroke_width_median():
    """스트로크 포인트들의 중앙값 굵기 반환."""
    # 10x20 이미지, 위쪽은 3px, 아래쪽은 7px 굵기
    img = Image.new('RGBA', (20, 20), (0, 0, 0, 0))

    # 위쪽 3px 굵기 (y=0~9)
    for y in range(10):
        for x in range(4, 7):
            img.putpixel((x, y), (0, 0, 0, 255))

    # 아래쪽 7px 굵기 (y=10~19)
    for y in range(10, 20):
        for x in range(2, 9):
            img.putpixel((x, y), (0, 0, 0, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    # 위쪽 3개, 아래쪽 2개 포인트 -> 중앙값은 3
    points = [
        [5, 2, 1], [5, 5, 2], [5, 8, 3],  # 위쪽 (굵기 3)
        [5, 12, 4], [5, 15, 5],            # 아래쪽 (굵기 7)
    ]
    width = extractor.extract_stroke_width(points)

    assert width == 3  # 중앙값


def test_extract_stroke_width_empty():
    """포인트가 없거나 모두 투명이면 기본값 1 반환."""
    img = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    assert extractor.extract_stroke_width([]) == 1
    assert extractor.extract_stroke_width([[5, 5, 1]]) == 1  # 투명
```

**Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py::test_extract_stroke_width_median -v`
Expected: FAIL with "AttributeError: 'ColorExtractor' object has no attribute 'extract_stroke_width'"

**Step 3: Write minimal implementation**

```python
# src/petrify_converter/color_extractor.py 상단에 import 추가
from statistics import median

# 메서드 추가
def extract_stroke_width(self, points: list[list]) -> int:
    """스트로크 포인트들의 대표 굵기 추출 (중앙값).

    Args:
        points: [[x, y, timestamp], ...] 형식

    Returns:
        굵기 (px). 측정 불가시 기본값 1.
    """
    widths = []
    for point in points:
        x, y = int(point[0]), int(point[1])
        w = self.get_width_at(x, y)
        if w > 0:
            widths.append(w)

    if not widths:
        return 1

    return int(median(widths))
```

**Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "feat: ColorExtractor에 extract_stroke_width 메서드 추가

중앙값으로 스트로크 대표 굵기 계산

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: ColorExtractor에서 불필요한 메서드 제거

**Files:**
- Modify: `src/petrify_converter/color_extractor.py`
- Modify: `tests/test_color_extractor.py`

**Step 1: 코드에서 제거**

`src/petrify_converter/color_extractor.py`에서 제거:
- `classify_pen_type` 메서드 (31-39행)
- `extract_stroke_color` 메서드 (41-65행)
- `ALPHA_THRESHOLD` 상수 (10행) - classify_pen_type에서만 사용

**Step 2: 테스트에서 제거**

`tests/test_color_extractor.py`에서 제거:
- `test_classify_pen_type_black`
- `test_classify_pen_type_highlighter`
- `test_classify_pen_type_at_alpha_threshold`
- `test_classify_pen_type_below_alpha_threshold`
- `test_extract_stroke_color`

**Step 3: Run tests to verify nothing broke**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py -v`
Expected: PASS (남은 테스트들)

**Step 4: Commit**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "refactor: ColorExtractor에서 미사용 메서드 제거

- classify_pen_type 제거
- extract_stroke_color 제거
- ALPHA_THRESHOLD 상수 제거

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Parser에서 굵기 추출 연동

**Files:**
- Modify: `src/petrify_converter/parser.py`
- Modify: `tests/test_parser.py`

**Step 1: Write the failing test**

```python
# tests/test_parser.py 에 추가
def test_parser_extracts_stroke_width():
    """스트로크 굵기가 mainBmp에서 추출됨."""
    various_text_dir = Path(__file__).parent.parent / "examples" / "various_text" / "extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    parser = NoteParser(various_text_dir)
    note = parser.parse()

    # 굵기가 추출되었는지 확인 (기본값 1.0이 아닌 값)
    widths = [stroke.width for page in note.pages for stroke in page.strokes]

    # 다양한 굵기가 있어야 함 (볼펜 ~6px, 형광펜 ~30-75px)
    assert max(widths) > 10  # 형광펜 굵기
```

**Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && pytest tests/test_parser.py::test_parser_extracts_stroke_width -v`
Expected: FAIL (모든 width가 기본값 1.0)

**Step 3: Modify _split_strokes_with_color to extract width**

```python
# src/petrify_converter/parser.py의 _split_strokes_with_color 메서드 수정

def _split_strokes_with_color(
    self, data: list[list], extractor: ColorExtractor
) -> list[Stroke]:
    """색상 및 굵기 추출하며 스트로크 분리."""
    if not data:
        return []

    sorted_data = sorted(data, key=lambda p: p[2])

    strokes = []
    current_points: list[list] = []  # raw point data 저장
    current_color: str | None = None
    current_alpha: int | None = None

    for i, point_data in enumerate(sorted_data):
        x, y = int(point_data[0]), int(point_data[1])
        color, alpha = extractor.get_color_at(x, y)

        is_background = color.lower() in ColorExtractor.BACKGROUND_COLORS

        if is_background:
            if current_color is not None:
                color = current_color
                alpha = current_alpha
            else:
                color = "#000000"
                alpha = 255

        if i > 0:
            prev_ts = sorted_data[i - 1][2]
            curr_ts = point_data[2]
            gap = curr_ts - prev_ts

            color_changed = (
                current_color is not None
                and not is_background
                and color != current_color
            )

            if gap >= self.DEFAULT_GAP_THRESHOLD or color_changed:
                if current_points:
                    # 굵기 추출
                    width = extractor.extract_stroke_width(current_points)
                    strokes.append(
                        Stroke(
                            points=[Point.from_list(p) for p in current_points],
                            color=current_color or "#000000",
                            width=float(width),
                            opacity=self._alpha_to_opacity(current_alpha),
                        )
                    )
                current_points = []

        current_points.append(point_data)
        if not is_background or current_color is None:
            current_color = color
            current_alpha = alpha

    if current_points:
        width = extractor.extract_stroke_width(current_points)
        strokes.append(
            Stroke(
                points=[Point.from_list(p) for p in current_points],
                color=current_color or "#000000",
                width=float(width),
                opacity=self._alpha_to_opacity(current_alpha),
            )
        )

    return strokes
```

**Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && pytest tests/test_parser.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/parser.py tests/test_parser.py
git commit -m "feat: Parser에서 스트로크 굵기 추출 연동

mainBmp에서 각 스트로크의 굵기를 자동으로 추출

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Page 모델에서 background_image 제거

**Files:**
- Modify: `src/petrify_converter/models/page.py`
- Modify: `tests/models/test_page.py`

**Step 1: Page 모델 수정**

```python
# src/petrify_converter/models/page.py
from dataclasses import dataclass

from petrify_converter.models.stroke import Stroke


@dataclass
class Page:
    id: str
    strokes: list[Stroke]
    width: float = 1440.0
    height: float = 1920.0
```

**Step 2: 테스트 수정**

`tests/models/test_page.py`에서 `test_page_with_background` 테스트 제거

**Step 3: Run tests**

Run: `source .venv/bin/activate && pytest tests/models/test_page.py -v`
Expected: PASS

**Step 4: Commit**

```bash
git add src/petrify_converter/models/page.py tests/models/test_page.py
git commit -m "refactor: Page 모델에서 background_image 필드 제거

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Parser에서 background_image 전달 제거

**Files:**
- Modify: `src/petrify_converter/parser.py`

**Step 1: _parse_pages 수정**

```python
# src/petrify_converter/parser.py의 _parse_pages 메서드

def _parse_pages(self) -> list[Page]:
    """페이지 파싱."""
    path_files = self._find_path_files()
    path_to_mainbmp = self._parse_page_resource()
    mainbmp_files = self._find_mainbmp_files()
    pages = []

    for path_file in path_files:
        page_id = path_file.stem.replace("path_", "")

        mainbmp_data = self._load_mainbmp(
            page_id, path_to_mainbmp, mainbmp_files
        )

        strokes = self._parse_strokes(path_file, mainbmp_data)

        page = Page(
            id=page_id,
            strokes=strokes,
        )
        pages.append(page)

    return pages if pages else [Page(id="empty", strokes=[])]
```

**Step 2: Run tests**

Run: `source .venv/bin/activate && pytest tests/test_parser.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/petrify_converter/parser.py
git commit -m "refactor: Parser에서 Page에 background_image 전달 제거

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: ExcalidrawGenerator에서 배경 이미지 기능 제거

**Files:**
- Modify: `src/petrify_converter/excalidraw.py`
- Modify: `tests/test_excalidraw.py`

**Step 1: ExcalidrawGenerator 수정**

```python
# src/petrify_converter/excalidraw.py 전체 교체
import random
import uuid
from typing import Any

from petrify_converter.models import Note, Page, Stroke


class ExcalidrawGenerator:
    PAGE_GAP = 100

    def generate(self, note: Note) -> dict[str, Any]:
        """Note를 Excalidraw 문서로 변환."""
        elements = []
        y_offset = 0

        for page in note.pages:
            page_elements = self._generate_page_elements(page, y_offset)
            elements.extend(page_elements)
            y_offset += page.height + self.PAGE_GAP

        return {
            "type": "excalidraw",
            "version": 2,
            "source": "petrify-converter",
            "elements": elements,
            "appState": {
                "gridSize": None,
                "viewBackgroundColor": "#ffffff",
            },
            "files": {},
        }

    def _generate_page_elements(
        self, page: Page, y_offset: float
    ) -> list[dict[str, Any]]:
        """페이지의 모든 요소 생성."""
        elements = []

        for stroke in page.strokes:
            element = self.create_freedraw(stroke, x_offset=0, y_offset=y_offset)
            elements.append(element)

        return elements

    def create_freedraw(
        self, stroke: Stroke, x_offset: float, y_offset: float
    ) -> dict[str, Any]:
        """Stroke를 freedraw 요소로 변환."""
        if not stroke.points:
            x, y = x_offset, y_offset
            points = []
            width, height = 0, 0
        else:
            first_point = stroke.points[0]
            x, y = first_point.x + x_offset, first_point.y + y_offset
            points = [[p.x - first_point.x, p.y - first_point.y] for p in stroke.points]
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            width = max(xs) - min(xs)
            height = max(ys) - min(ys)

        return {
            "type": "freedraw",
            "id": self._generate_id(),
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "strokeColor": stroke.color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": int(stroke.width),
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": stroke.opacity,
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

    @staticmethod
    def _generate_id() -> str:
        """고유 ID 생성 (40자리 16진수, Obsidian Excalidraw 플러그인 호환)."""
        return uuid.uuid4().hex + uuid.uuid4().hex[:8]

    @staticmethod
    def _generate_seed() -> int:
        """랜덤 seed 생성."""
        return random.randint(1, 2147483647)
```

**Step 2: 테스트에서 include_background 관련 제거**

`tests/test_excalidraw.py`에서:
- `ExcalidrawGenerator()` 생성 시 `include_background` 파라미터 제거

**Step 3: Run tests**

Run: `source .venv/bin/activate && pytest tests/test_excalidraw.py -v`
Expected: PASS

**Step 4: Commit**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "refactor: ExcalidrawGenerator에서 배경 이미지 기능 제거

- include_background 파라미터 제거
- create_image 메서드 제거
- files 딕셔너리 항상 빈 객체

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: converter.py 정리

**Files:**
- Modify: `src/petrify_converter/converter.py`

**Step 1: include_background 파라미터 제거 확인**

`src/petrify_converter/converter.py`에서 `ExcalidrawGenerator` 생성 시 `include_background` 파라미터가 있다면 제거

**Step 2: Run tests**

Run: `source .venv/bin/activate && pytest tests/test_converter.py -v`
Expected: PASS

**Step 3: Commit (변경사항 있으면)**

```bash
git add src/petrify_converter/converter.py
git commit -m "refactor: converter에서 include_background 옵션 제거

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: 통합 테스트 업데이트

**Files:**
- Modify: `tests/test_integration.py`

**Step 1: 굵기 검증 테스트 추가**

```python
# tests/test_integration.py 에 추가
def test_various_text_stroke_width_extraction(tmp_path):
    """various_text 예시에서 굵기가 올바르게 추출됨."""
    various_text_dir = Path(__file__).parent.parent / "examples/various_text/extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    output_path = tmp_path / "various_text_width.excalidraw"
    convert(various_text_dir, output_path)

    with open(output_path) as f:
        content = f.read()

    import json
    data = json.loads(content)

    # strokeWidth 값들 추출
    widths = [el.get("strokeWidth", 1) for el in data["elements"] if el["type"] == "freedraw"]

    # 다양한 굵기가 있어야 함
    assert len(set(widths)) > 1, f"모든 굵기가 동일: {set(widths)}"
    assert max(widths) > 10, f"형광펜 굵기가 없음: max={max(widths)}"
```

**Step 2: Run tests**

Run: `source .venv/bin/activate && pytest tests/test_integration.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: 스트로크 굵기 추출 통합 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: 전체 테스트 및 최종 검증

**Step 1: 전체 테스트 실행**

Run: `source .venv/bin/activate && pytest -v`
Expected: ALL PASS

**Step 2: 실제 변환 테스트**

```bash
source .venv/bin/activate && python -c "
from petrify_converter import convert
convert(
    'examples/various_text/extracted',
    '/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_final.excalidraw.md'
)
print('변환 완료')
"
```

**Step 3: Obsidian에서 확인**

- 검정 볼펜: 가는 선 (~6px)
- 파란 형광펜: 굵은 선 (~74px), 파란색, 투명도 있음
- 분홍 형광펜: 중간 굵기 (~30px), 분홍색, 투명도 있음

**Step 4: code-simplifier로 리팩터링**

모든 작업 완료 후 code-simplifier 에이전트로 코드 정리

---

## 완료 체크리스트

- [ ] Task 1: get_width_at 메서드 추가
- [ ] Task 2: extract_stroke_width 메서드 추가
- [ ] Task 3: 불필요한 ColorExtractor 메서드 제거
- [ ] Task 4: Parser에서 굵기 추출 연동
- [ ] Task 5: Page 모델에서 background_image 제거
- [ ] Task 6: Parser에서 background_image 전달 제거
- [ ] Task 7: ExcalidrawGenerator에서 배경 이미지 기능 제거
- [ ] Task 8: converter.py 정리
- [ ] Task 9: 통합 테스트 업데이트
- [ ] Task 10: 전체 테스트 및 최종 검증
