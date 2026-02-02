# Petrify Converter 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** viwoods note 파일을 Excalidraw 포맷으로 변환하는 Python 라이브러리 구현

**Architecture:** note 파일(zip)을 파싱하여 데이터 모델로 변환 후, Excalidraw JSON으로 직렬화. 모듈은 parser → models → excalidraw → converter 순으로 의존.

**Tech Stack:** Python 3.11+, pytest, dataclasses, zipfile, json

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `pyproject.toml`
- Create: `src/petrify_converter/__init__.py`

**Step 1: pyproject.toml 생성**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "petrify-converter"
version = "0.1.0"
description = "viwoods note to Excalidraw converter"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = ["pytest>=8.0.0"]

[tool.hatch.build.targets.wheel]
packages = ["src/petrify_converter"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
```

**Step 2: __init__.py 생성**

```python
"""Petrify Converter - viwoods note to Excalidraw converter."""

__version__ = "0.1.0"
```

**Step 3: 디렉터리 구조 생성**

```bash
mkdir -p src/petrify_converter/models tests
touch src/petrify_converter/models/__init__.py
```

**Step 4: 설치 확인**

Run: `pip install -e ".[dev]"`
Expected: Successfully installed petrify-converter

**Step 5: Commit**

```bash
git add pyproject.toml src/ tests/
git commit -m "chore: 프로젝트 초기 설정"
```

---

## Task 2: Point 모델 구현

**Files:**
- Create: `src/petrify_converter/models/stroke.py`
- Create: `tests/models/test_stroke.py`
- Modify: `src/petrify_converter/models/__init__.py`

**Step 1: 테스트 디렉터리 생성**

```bash
mkdir -p tests/models
touch tests/__init__.py tests/models/__init__.py
```

**Step 2: Point 실패 테스트 작성**

```python
# tests/models/test_stroke.py
from petrify_converter.models import Point


def test_point_creation():
    point = Point(x=100.0, y=200.0, timestamp=1234567890)

    assert point.x == 100.0
    assert point.y == 200.0
    assert point.timestamp == 1234567890


def test_point_from_list():
    point = Point.from_list([100, 200, 1234567890])

    assert point.x == 100.0
    assert point.y == 200.0
    assert point.timestamp == 1234567890
```

**Step 3: 테스트 실패 확인**

Run: `pytest tests/models/test_stroke.py -v`
Expected: FAIL with "cannot import name 'Point'"

**Step 4: Point 구현**

```python
# src/petrify_converter/models/stroke.py
from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float
    timestamp: int

    @classmethod
    def from_list(cls, data: list) -> "Point":
        return cls(x=float(data[0]), y=float(data[1]), timestamp=int(data[2]))
```

**Step 5: models/__init__.py 업데이트**

```python
# src/petrify_converter/models/__init__.py
from petrify_converter.models.stroke import Point

__all__ = ["Point"]
```

**Step 6: 테스트 통과 확인**

Run: `pytest tests/models/test_stroke.py -v`
Expected: PASS

**Step 7: Commit**

```bash
git add src/petrify_converter/models/ tests/
git commit -m "feat: Point 모델 구현"
```

---

## Task 3: Stroke 모델 구현

**Files:**
- Modify: `src/petrify_converter/models/stroke.py`
- Modify: `tests/models/test_stroke.py`
- Modify: `src/petrify_converter/models/__init__.py`

**Step 1: Stroke 실패 테스트 작성**

```python
# tests/models/test_stroke.py 에 추가
from petrify_converter.models import Point, Stroke


def test_stroke_creation():
    points = [Point(0, 0, 0), Point(10, 10, 1)]
    stroke = Stroke(points=points)

    assert len(stroke.points) == 2
    assert stroke.color == "#000000"
    assert stroke.width == 1.0


def test_stroke_custom_style():
    points = [Point(0, 0, 0)]
    stroke = Stroke(points=points, color="#ff0000", width=2.5)

    assert stroke.color == "#ff0000"
    assert stroke.width == 2.5


def test_stroke_from_path_data():
    path_data = [[0, 0, 100], [10, 5, 101], [20, 10, 102]]
    stroke = Stroke.from_path_data(path_data)

    assert len(stroke.points) == 3
    assert stroke.points[0].x == 0
    assert stroke.points[2].y == 10
```

**Step 2: 테스트 실패 확인**

Run: `pytest tests/models/test_stroke.py::test_stroke_creation -v`
Expected: FAIL with "cannot import name 'Stroke'"

**Step 3: Stroke 구현**

```python
# src/petrify_converter/models/stroke.py
from dataclasses import dataclass, field


@dataclass
class Point:
    x: float
    y: float
    timestamp: int

    @classmethod
    def from_list(cls, data: list) -> "Point":
        return cls(x=float(data[0]), y=float(data[1]), timestamp=int(data[2]))


@dataclass
class Stroke:
    points: list[Point]
    color: str = "#000000"
    width: float = 1.0

    @classmethod
    def from_path_data(
        cls, data: list[list], color: str = "#000000", width: float = 1.0
    ) -> "Stroke":
        points = [Point.from_list(p) for p in data]
        return cls(points=points, color=color, width=width)
```

**Step 4: models/__init__.py 업데이트**

```python
# src/petrify_converter/models/__init__.py
from petrify_converter.models.stroke import Point, Stroke

__all__ = ["Point", "Stroke"]
```

**Step 5: 테스트 통과 확인**

Run: `pytest tests/models/test_stroke.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/models/ tests/
git commit -m "feat: Stroke 모델 구현"
```

---

## Task 4: Page 모델 구현

**Files:**
- Create: `src/petrify_converter/models/page.py`
- Create: `tests/models/test_page.py`
- Modify: `src/petrify_converter/models/__init__.py`

**Step 1: Page 실패 테스트 작성**

```python
# tests/models/test_page.py
from petrify_converter.models import Page, Stroke, Point


def test_page_creation():
    stroke = Stroke(points=[Point(0, 0, 0)])
    page = Page(id="page-1", strokes=[stroke])

    assert page.id == "page-1"
    assert len(page.strokes) == 1
    assert page.width == 1440.0
    assert page.height == 1920.0
    assert page.background_image is None


def test_page_custom_dimensions():
    page = Page(id="page-1", strokes=[], width=800.0, height=600.0)

    assert page.width == 800.0
    assert page.height == 600.0


def test_page_with_background():
    image_data = b"fake-image-data"
    page = Page(id="page-1", strokes=[], background_image=image_data)

    assert page.background_image == image_data
```

**Step 2: 테스트 실패 확인**

Run: `pytest tests/models/test_page.py -v`
Expected: FAIL with "cannot import name 'Page'"

**Step 3: Page 구현**

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
    background_image: bytes | None = None
```

**Step 4: models/__init__.py 업데이트**

```python
# src/petrify_converter/models/__init__.py
from petrify_converter.models.stroke import Point, Stroke
from petrify_converter.models.page import Page

__all__ = ["Point", "Stroke", "Page"]
```

**Step 5: 테스트 통과 확인**

Run: `pytest tests/models/test_page.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/models/ tests/
git commit -m "feat: Page 모델 구현"
```

---

## Task 5: Note 모델 구현

**Files:**
- Create: `src/petrify_converter/models/note.py`
- Create: `tests/models/test_note.py`
- Modify: `src/petrify_converter/models/__init__.py`

**Step 1: Note 실패 테스트 작성**

```python
# tests/models/test_note.py
from datetime import datetime

from petrify_converter.models import Note, Page


def test_note_creation():
    page = Page(id="page-1", strokes=[])
    created = datetime(2026, 1, 30, 10, 39)
    modified = datetime(2026, 2, 1, 12, 0)

    note = Note(
        title="테스트 노트",
        pages=[page],
        created_at=created,
        modified_at=modified,
    )

    assert note.title == "테스트 노트"
    assert len(note.pages) == 1
    assert note.created_at == created
    assert note.modified_at == modified


def test_note_multiple_pages():
    pages = [Page(id=f"page-{i}", strokes=[]) for i in range(3)]
    note = Note(
        title="멀티 페이지",
        pages=pages,
        created_at=datetime.now(),
        modified_at=datetime.now(),
    )

    assert len(note.pages) == 3
```

**Step 2: 테스트 실패 확인**

Run: `pytest tests/models/test_note.py -v`
Expected: FAIL with "cannot import name 'Note'"

**Step 3: Note 구현**

```python
# src/petrify_converter/models/note.py
from dataclasses import dataclass
from datetime import datetime

from petrify_converter.models.page import Page


@dataclass
class Note:
    title: str
    pages: list[Page]
    created_at: datetime
    modified_at: datetime
```

**Step 4: models/__init__.py 업데이트**

```python
# src/petrify_converter/models/__init__.py
from petrify_converter.models.stroke import Point, Stroke
from petrify_converter.models.page import Page
from petrify_converter.models.note import Note

__all__ = ["Point", "Stroke", "Page", "Note"]
```

**Step 5: 테스트 통과 확인**

Run: `pytest tests/models/test_note.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/models/ tests/
git commit -m "feat: Note 모델 구현"
```

---

## Task 6: 커스텀 예외 구현

**Files:**
- Create: `src/petrify_converter/exceptions.py`
- Create: `tests/test_exceptions.py`
- Modify: `src/petrify_converter/__init__.py`

**Step 1: 예외 실패 테스트 작성**

```python
# tests/test_exceptions.py
import pytest

from petrify_converter.exceptions import InvalidNoteFileError, ParseError


def test_invalid_note_file_error():
    with pytest.raises(InvalidNoteFileError) as exc_info:
        raise InvalidNoteFileError("not a zip file")

    assert "not a zip file" in str(exc_info.value)


def test_parse_error():
    with pytest.raises(ParseError) as exc_info:
        raise ParseError("invalid JSON")

    assert "invalid JSON" in str(exc_info.value)


def test_exceptions_inherit_from_exception():
    assert issubclass(InvalidNoteFileError, Exception)
    assert issubclass(ParseError, Exception)
```

**Step 2: 테스트 실패 확인**

Run: `pytest tests/test_exceptions.py -v`
Expected: FAIL with "No module named 'petrify_converter.exceptions'"

**Step 3: 예외 구현**

```python
# src/petrify_converter/exceptions.py
class PetrifyError(Exception):
    """Base exception for petrify-converter."""

    pass


class InvalidNoteFileError(PetrifyError):
    """Raised when the note file is invalid."""

    pass


class ParseError(PetrifyError):
    """Raised when parsing fails."""

    pass
```

**Step 4: 테스트 통과 확인**

Run: `pytest tests/test_exceptions.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/exceptions.py tests/test_exceptions.py
git commit -m "feat: 커스텀 예외 클래스 구현"
```

---

## Task 7: Parser 구현 - zip 압축 해제

**Files:**
- Create: `src/petrify_converter/parser.py`
- Create: `tests/test_parser.py`

**Step 1: 테스트용 fixture 설정**

```python
# tests/conftest.py
import pytest
from pathlib import Path


@pytest.fixture
def examples_dir() -> Path:
    return Path(__file__).parent.parent / "examples"


@pytest.fixture
def example_note_files(examples_dir) -> dict[str, Path]:
    files = {}
    for f in examples_dir.iterdir():
        files[f.name] = f
    return files
```

**Step 2: Parser 실패 테스트 작성**

```python
# tests/test_parser.py
import pytest
from pathlib import Path

from petrify_converter.parser import NoteParser
from petrify_converter.exceptions import InvalidNoteFileError


def test_parser_with_invalid_file(tmp_path):
    invalid_file = tmp_path / "invalid.note"
    invalid_file.write_text("not a zip file")

    parser = NoteParser(invalid_file)

    with pytest.raises(InvalidNoteFileError):
        parser.parse()


def test_parser_with_nonexistent_file():
    with pytest.raises(FileNotFoundError):
        NoteParser(Path("/nonexistent/file.note"))


def test_parser_extracts_files(examples_dir):
    # examples 디렉터리의 파일들을 직접 테스트
    parser = NoteParser(examples_dir)

    assert parser._find_path_files() is not None
```

**Step 3: 테스트 실패 확인**

Run: `pytest tests/test_parser.py::test_parser_with_nonexistent_file -v`
Expected: FAIL with "No module named 'petrify_converter.parser'"

**Step 4: Parser 기본 구현**

```python
# src/petrify_converter/parser.py
import json
import zipfile
from datetime import datetime
from pathlib import Path

from petrify_converter.exceptions import InvalidNoteFileError, ParseError
from petrify_converter.models import Note, Page, Stroke


class NoteParser:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        if not self.path.exists():
            raise FileNotFoundError(f"File not found: {self.path}")

        self._extracted_dir: Path | None = None
        self._is_directory = self.path.is_dir()

    def _find_path_files(self) -> list[Path]:
        """path_*.json 파일 찾기."""
        if self._is_directory:
            search_dir = self.path
        else:
            search_dir = self._extracted_dir

        if search_dir is None:
            return []

        return list(search_dir.glob("path_*.json"))

    def _find_file_by_suffix(self, suffix: str) -> Path | None:
        """특정 suffix로 끝나는 파일 찾기."""
        if self._is_directory:
            search_dir = self.path
        else:
            search_dir = self._extracted_dir

        if search_dir is None:
            return None

        for f in search_dir.iterdir():
            if f.name.endswith(suffix):
                return f
        return None

    def parse(self) -> Note:
        """note 파일 파싱."""
        if self._is_directory:
            return self._parse_directory()
        else:
            return self._parse_zip()

    def _parse_zip(self) -> Note:
        """zip 파일 파싱."""
        import tempfile

        try:
            with zipfile.ZipFile(self.path, "r") as zf:
                with tempfile.TemporaryDirectory() as tmpdir:
                    zf.extractall(tmpdir)
                    self._extracted_dir = Path(tmpdir)
                    return self._parse_contents()
        except zipfile.BadZipFile:
            raise InvalidNoteFileError(f"Not a valid zip file: {self.path}")

    def _parse_directory(self) -> Note:
        """디렉터리 파싱 (이미 압축 해제된 경우)."""
        return self._parse_contents()

    def _parse_contents(self) -> Note:
        """압축 해제된 내용 파싱."""
        note_info = self._parse_note_info()
        pages = self._parse_pages()

        return Note(
            title=note_info.get("fileName", "Untitled"),
            pages=pages,
            created_at=self._timestamp_to_datetime(note_info.get("creationTime", 0)),
            modified_at=self._timestamp_to_datetime(note_info.get("lastModifiedTime", 0)),
        )

    def _parse_note_info(self) -> dict:
        """NoteFileInfo.json 파싱."""
        info_file = self._find_file_by_suffix("_NoteFileInfo.json")
        if info_file is None:
            return {}

        try:
            return json.loads(info_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ParseError(f"Failed to parse NoteFileInfo: {e}")

    def _parse_pages(self) -> list[Page]:
        """페이지 파싱."""
        path_files = self._find_path_files()
        pages = []

        for path_file in path_files:
            page_id = path_file.stem.replace("path_", "")
            strokes = self._parse_strokes(path_file)

            page = Page(
                id=page_id,
                strokes=strokes,
            )
            pages.append(page)

        return pages if pages else [Page(id="empty", strokes=[])]

    def _parse_strokes(self, path_file: Path) -> list[Stroke]:
        """스트로크 파싱."""
        try:
            data = json.loads(path_file.read_text(encoding="utf-8"))
            return [Stroke.from_path_data(data)]
        except json.JSONDecodeError as e:
            raise ParseError(f"Failed to parse stroke data: {e}")

    @staticmethod
    def _timestamp_to_datetime(timestamp: int) -> datetime:
        """밀리초 타임스탬프를 datetime으로 변환."""
        if timestamp == 0:
            return datetime.now()
        return datetime.fromtimestamp(timestamp / 1000)
```

**Step 5: 테스트 통과 확인**

Run: `pytest tests/test_parser.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/parser.py tests/test_parser.py tests/conftest.py
git commit -m "feat: NoteParser 구현"
```

---

## Task 8: Excalidraw 요소 생성기 구현

**Files:**
- Create: `src/petrify_converter/excalidraw.py`
- Create: `tests/test_excalidraw.py`

**Step 1: Excalidraw 요소 실패 테스트 작성**

```python
# tests/test_excalidraw.py
import json

from petrify_converter.excalidraw import ExcalidrawGenerator
from petrify_converter.models import Point, Stroke, Page, Note
from datetime import datetime


def test_generate_freedraw_element():
    points = [Point(0, 0, 0), Point(10, 5, 1), Point(20, 10, 2)]
    stroke = Stroke(points=points, color="#000000", width=1.0)

    generator = ExcalidrawGenerator()
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)

    assert element["type"] == "freedraw"
    assert element["strokeColor"] == "#000000"
    assert element["strokeWidth"] == 1
    assert len(element["points"]) == 3
    assert element["points"][0] == [0, 0]


def test_freedraw_element_has_required_fields():
    stroke = Stroke(points=[Point(0, 0, 0)], color="#ff0000", width=2.0)

    generator = ExcalidrawGenerator()
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)

    required_fields = [
        "type", "id", "x", "y", "width", "height",
        "strokeColor", "strokeWidth", "points",
        "opacity", "roughness", "seed",
    ]

    for field in required_fields:
        assert field in element, f"Missing field: {field}"


def test_generate_full_document():
    page = Page(
        id="page-1",
        strokes=[Stroke(points=[Point(0, 0, 0), Point(10, 10, 1)])],
    )
    note = Note(
        title="Test",
        pages=[page],
        created_at=datetime.now(),
        modified_at=datetime.now(),
    )

    generator = ExcalidrawGenerator()
    doc = generator.generate(note)

    assert doc["type"] == "excalidraw"
    assert doc["version"] == 2
    assert "elements" in doc
    assert "appState" in doc
```

**Step 2: 테스트 실패 확인**

Run: `pytest tests/test_excalidraw.py -v`
Expected: FAIL with "No module named 'petrify_converter.excalidraw'"

**Step 3: ExcalidrawGenerator 구현**

```python
# src/petrify_converter/excalidraw.py
import random
import uuid
from typing import Any

from petrify_converter.models import Note, Page, Stroke


class ExcalidrawGenerator:
    PAGE_GAP = 100  # 페이지 간 간격

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
            return self._empty_freedraw(x_offset, y_offset, stroke)

        # 첫 번째 포인트를 기준으로 정규화
        first_point = stroke.points[0]
        points = [[p.x - first_point.x, p.y - first_point.y] for p in stroke.points]

        # bounding box 계산
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
            "opacity": 100,
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

    def _empty_freedraw(
        self, x_offset: float, y_offset: float, stroke: Stroke
    ) -> dict[str, Any]:
        """빈 freedraw 요소 생성."""
        return {
            "type": "freedraw",
            "id": self._generate_id(),
            "x": x_offset,
            "y": y_offset,
            "width": 0,
            "height": 0,
            "strokeColor": stroke.color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": int(stroke.width),
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "angle": 0,
            "points": [],
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
        """고유 ID 생성."""
        return str(uuid.uuid4())[:20]

    @staticmethod
    def _generate_seed() -> int:
        """랜덤 seed 생성."""
        return random.randint(1, 2147483647)
```

**Step 4: 테스트 통과 확인**

Run: `pytest tests/test_excalidraw.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "feat: ExcalidrawGenerator 구현"
```

---

## Task 9: Converter 및 공개 API 구현

**Files:**
- Create: `src/petrify_converter/converter.py`
- Create: `tests/test_converter.py`
- Modify: `src/petrify_converter/__init__.py`

**Step 1: Converter 실패 테스트 작성**

```python
# tests/test_converter.py
import json
from pathlib import Path

import pytest

from petrify_converter import convert
from petrify_converter.exceptions import InvalidNoteFileError


def test_convert_directory(examples_dir, tmp_path):
    output_path = tmp_path / "output.excalidraw"

    convert(examples_dir, output_path)

    assert output_path.exists()

    with open(output_path) as f:
        data = json.load(f)

    assert data["type"] == "excalidraw"
    assert len(data["elements"]) > 0


def test_convert_with_custom_stroke_options(examples_dir, tmp_path):
    output_path = tmp_path / "output.excalidraw"

    convert(
        examples_dir,
        output_path,
        stroke_color="#ff0000",
        stroke_width=2,
    )

    with open(output_path) as f:
        data = json.load(f)

    if data["elements"]:
        assert data["elements"][0]["strokeColor"] == "#ff0000"
        assert data["elements"][0]["strokeWidth"] == 2


def test_convert_nonexistent_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        convert(tmp_path / "nonexistent.note", tmp_path / "output.excalidraw")
```

**Step 2: 테스트 실패 확인**

Run: `pytest tests/test_converter.py -v`
Expected: FAIL with "cannot import name 'convert'"

**Step 3: Converter 구현**

```python
# src/petrify_converter/converter.py
import json
from pathlib import Path

from petrify_converter.excalidraw import ExcalidrawGenerator
from petrify_converter.parser import NoteParser


def convert(
    input_path: Path | str,
    output_path: Path | str,
    *,
    include_background: bool = False,
    stroke_color: str | None = None,
    stroke_width: float | None = None,
) -> None:
    """note 파일을 Excalidraw 포맷으로 변환.

    Args:
        input_path: 입력 note 파일 또는 디렉터리 경로
        output_path: 출력 excalidraw 파일 경로
        include_background: 배경 이미지 포함 여부
        stroke_color: 스트로크 색상 (기본: #000000)
        stroke_width: 스트로크 굵기 (기본: 1.0)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    parser = NoteParser(input_path)
    note = parser.parse()

    # 스트로크 스타일 적용
    if stroke_color is not None or stroke_width is not None:
        for page in note.pages:
            for stroke in page.strokes:
                if stroke_color is not None:
                    stroke.color = stroke_color
                if stroke_width is not None:
                    stroke.width = stroke_width

    generator = ExcalidrawGenerator()
    document = generator.generate(note)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(document, f, ensure_ascii=False, indent=2)
```

**Step 4: __init__.py 업데이트**

```python
# src/petrify_converter/__init__.py
"""Petrify Converter - viwoods note to Excalidraw converter."""

from petrify_converter.converter import convert
from petrify_converter.exceptions import InvalidNoteFileError, ParseError

__version__ = "0.1.0"
__all__ = ["convert", "InvalidNoteFileError", "ParseError"]
```

**Step 5: 테스트 통과 확인**

Run: `pytest tests/test_converter.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/ tests/test_converter.py
git commit -m "feat: convert 함수 및 공개 API 구현"
```

---

## Task 10: 통합 테스트 및 실제 변환 확인

**Files:**
- Create: `tests/test_integration.py`

**Step 1: 통합 테스트 작성**

```python
# tests/test_integration.py
import json
from pathlib import Path

from petrify_converter import convert


def test_full_conversion_pipeline(examples_dir, tmp_path):
    """실제 예시 파일로 전체 파이프라인 테스트."""
    output_path = tmp_path / "integrated_output.excalidraw"

    convert(examples_dir, output_path)

    assert output_path.exists()

    with open(output_path) as f:
        data = json.load(f)

    # 기본 구조 검증
    assert data["type"] == "excalidraw"
    assert data["version"] == 2
    assert "elements" in data
    assert "appState" in data

    # 요소가 존재하는지 확인
    assert len(data["elements"]) > 0

    # freedraw 요소인지 확인
    for element in data["elements"]:
        assert element["type"] == "freedraw"
        assert "points" in element
        assert len(element["points"]) > 0


def test_output_can_be_opened_as_valid_json(examples_dir, tmp_path):
    """출력 파일이 유효한 JSON인지 확인."""
    output_path = tmp_path / "valid_json.excalidraw"

    convert(examples_dir, output_path)

    # JSON으로 다시 읽어서 검증
    with open(output_path) as f:
        content = f.read()

    # JSON 파싱이 성공해야 함
    parsed = json.loads(content)
    assert parsed is not None
```

**Step 2: 테스트 실행**

Run: `pytest tests/test_integration.py -v`
Expected: PASS

**Step 3: 실제 변환 결과 확인**

```bash
cd /Users/minjun.jo/Projects/me/petrify
python -c "
from petrify_converter import convert
convert('examples', 'output.excalidraw')
print('변환 완료: output.excalidraw')
"
```

**Step 4: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: 통합 테스트 추가"
```

---

## Task 11: 전체 테스트 실행 및 최종 정리

**Step 1: 전체 테스트 실행**

Run: `pytest -v`
Expected: All tests PASS

**Step 2: 코드 정리 확인**

```bash
# 사용하지 않는 import 확인
python -m py_compile src/petrify_converter/*.py
python -m py_compile src/petrify_converter/models/*.py
```

**Step 3: 최종 Commit**

```bash
git add -A
git commit -m "chore: petrify-converter v0.1.0 완성"
```

---

## 요약

| Task | 내용 | 예상 파일 |
|------|------|----------|
| 1 | 프로젝트 초기 설정 | pyproject.toml, __init__.py |
| 2 | Point 모델 | models/stroke.py |
| 3 | Stroke 모델 | models/stroke.py |
| 4 | Page 모델 | models/page.py |
| 5 | Note 모델 | models/note.py |
| 6 | 커스텀 예외 | exceptions.py |
| 7 | Parser | parser.py |
| 8 | Excalidraw 생성기 | excalidraw.py |
| 9 | Converter API | converter.py, __init__.py |
| 10 | 통합 테스트 | test_integration.py |
| 11 | 최종 정리 | - |
