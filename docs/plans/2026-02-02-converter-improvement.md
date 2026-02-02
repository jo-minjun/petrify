# Petrify Converter 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** viwoods note → Excalidraw 변환기의 출력 포맷과 좌표 변환 로직 개선

**Architecture:**
1. 스트로크 파싱 로직 수정: timestamp 정렬 + gap >= 6 기준 스트로크 분리
2. 출력 포맷 변경: .excalidraw.md (Obsidian Excalidraw 플러그인 포맷, LZString 압축)

**Tech Stack:** Python, LZString (lzstring 패키지)

---

## Task 1: lzstring 의존성 추가

**Files:**
- Modify: `pyproject.toml`

**Step 1: pyproject.toml에 lzstring 의존성 추가**

```toml
[project]
dependencies = ["lzstring>=1.0.4"]
```

**Step 2: 의존성 설치**

Run: `pip install -e .`

**Step 3: 설치 확인**

Run: `python -c "import lzstring; print('OK')"`
Expected: OK

**Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "chore: lzstring 의존성 추가"
```

---

## Task 2: 스트로크 분리 로직 구현 - 테스트 작성

**Files:**
- Modify: `src/petrify_converter/models/stroke.py`
- Modify: `tests/models/test_stroke.py`

**Step 1: 스트로크 분리 함수 테스트 작성**

`tests/models/test_stroke.py`에 추가:

```python
def test_split_strokes_by_timestamp_gap():
    """gap >= 6 기준으로 스트로크 분리."""
    # 두 개의 스트로크: ts 1-5, ts 11-15 (gap=6)
    data = [
        [100, 100, 1],
        [101, 101, 2],
        [102, 102, 3],
        [103, 103, 4],
        [104, 104, 5],
        # gap = 6 (11 - 5 = 6)
        [200, 200, 11],
        [201, 201, 12],
        [202, 202, 13],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    assert len(strokes) == 2
    assert len(strokes[0].points) == 5
    assert len(strokes[1].points) == 3
    assert strokes[0].points[0].x == 100
    assert strokes[1].points[0].x == 200


def test_split_strokes_sorts_by_timestamp():
    """timestamp 순서로 정렬 후 분리."""
    # 정렬되지 않은 데이터
    data = [
        [200, 200, 11],
        [100, 100, 1],
        [101, 101, 2],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    assert len(strokes) == 2
    # 첫 번째 스트로크는 ts 1, 2
    assert strokes[0].points[0].timestamp == 1
    assert strokes[0].points[1].timestamp == 2
    # 두 번째 스트로크는 ts 11
    assert strokes[1].points[0].timestamp == 11


def test_split_strokes_single_stroke():
    """gap이 threshold 미만이면 하나의 스트로크."""
    data = [
        [100, 100, 1],
        [101, 101, 2],
        [102, 102, 3],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    assert len(strokes) == 1
    assert len(strokes[0].points) == 3


def test_split_strokes_empty_data():
    """빈 데이터는 빈 리스트 반환."""
    strokes = Stroke.split_by_timestamp_gap([], gap_threshold=6)

    assert len(strokes) == 0
```

**Step 2: 테스트 실행 - 실패 확인**

Run: `pytest tests/models/test_stroke.py -v`
Expected: FAIL (split_by_timestamp_gap 메서드 없음)

**Step 3: Commit (테스트만)**

```bash
git add tests/models/test_stroke.py
git commit -m "test: 스트로크 분리 테스트 추가"
```

---

## Task 3: 스트로크 분리 로직 구현

**Files:**
- Modify: `src/petrify_converter/models/stroke.py`

**Step 1: split_by_timestamp_gap 메서드 구현**

`src/petrify_converter/models/stroke.py`의 Stroke 클래스에 추가:

```python
@classmethod
def split_by_timestamp_gap(
    cls,
    data: list[list],
    gap_threshold: int = 6,
    color: str = "#000000",
    width: float = 1.0,
) -> list["Stroke"]:
    """timestamp gap 기준으로 스트로크 분리.

    Args:
        data: [[x, y, timestamp], ...] 형식의 점 데이터
        gap_threshold: 스트로크 분리 기준 gap (이상)
        color: 스트로크 색상
        width: 스트로크 굵기

    Returns:
        분리된 Stroke 리스트
    """
    if not data:
        return []

    # timestamp 순서로 정렬
    sorted_data = sorted(data, key=lambda p: p[2])

    strokes = []
    current_points = [Point.from_list(sorted_data[0])]

    for i in range(1, len(sorted_data)):
        prev_ts = sorted_data[i - 1][2]
        curr_ts = sorted_data[i][2]
        gap = curr_ts - prev_ts

        if gap >= gap_threshold:
            # 새 스트로크 시작
            strokes.append(cls(points=current_points, color=color, width=width))
            current_points = []

        current_points.append(Point.from_list(sorted_data[i]))

    # 마지막 스트로크 추가
    if current_points:
        strokes.append(cls(points=current_points, color=color, width=width))

    return strokes
```

**Step 2: 테스트 실행 - 통과 확인**

Run: `pytest tests/models/test_stroke.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/petrify_converter/models/stroke.py
git commit -m "feat: timestamp gap 기준 스트로크 분리 구현"
```

---

## Task 4: Parser에서 스트로크 분리 적용

**Files:**
- Modify: `src/petrify_converter/parser.py`
- Modify: `tests/test_parser.py`

**Step 1: 테스트 추가**

`tests/test_parser.py`에 추가:

```python
def test_parser_splits_strokes_by_timestamp(examples_dir):
    """Parser가 timestamp gap 기준으로 스트로크를 분리."""
    parser = NoteParser(examples_dir)
    note = parser.parse()

    # examples 데이터는 248개 스트로크로 분리되어야 함
    total_strokes = sum(len(page.strokes) for page in note.pages)
    assert total_strokes > 1  # 최소한 여러 스트로크로 분리됨
```

**Step 2: 테스트 실행 - 실패 확인**

Run: `pytest tests/test_parser.py::test_parser_splits_strokes_by_timestamp -v`
Expected: FAIL (현재 1개 스트로크만 반환)

**Step 3: _parse_strokes 수정**

`src/petrify_converter/parser.py`의 `_parse_strokes` 메서드 수정:

```python
def _parse_strokes(self, path_file: Path) -> list[Stroke]:
    """스트로크 파싱."""
    try:
        data = json.loads(path_file.read_text(encoding="utf-8"))
        return Stroke.split_by_timestamp_gap(data, gap_threshold=6)
    except json.JSONDecodeError as e:
        raise ParseError(f"Failed to parse stroke data: {e}")
```

**Step 4: 테스트 실행 - 통과 확인**

Run: `pytest tests/test_parser.py -v`
Expected: PASS

**Step 5: 전체 테스트 실행**

Run: `pytest -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/parser.py tests/test_parser.py
git commit -m "feat: Parser에서 timestamp gap 기준 스트로크 분리 적용"
```

---

## Task 5: Excalidraw Markdown 포맷 생성기 - 테스트 작성

**Files:**
- Create: `tests/test_excalidraw_md.py`

**Step 1: 테스트 파일 생성**

```python
# tests/test_excalidraw_md.py
import json

import pytest

from petrify_converter.excalidraw_md import ExcalidrawMdGenerator


def test_generate_md_structure():
    """생성된 마크다운이 올바른 구조를 가짐."""
    generator = ExcalidrawMdGenerator()
    excalidraw_data = {
        "type": "excalidraw",
        "version": 2,
        "elements": [],
        "appState": {"viewBackgroundColor": "#ffffff"},
        "files": {},
    }

    md = generator.generate(excalidraw_data)

    assert "---" in md  # frontmatter
    assert "excalidraw-plugin: parsed" in md
    assert "# Excalidraw Data" in md
    assert "## Text Elements" in md
    assert "## Drawing" in md
    assert "```compressed-json" in md


def test_generate_md_compressed():
    """Excalidraw 데이터가 압축됨."""
    generator = ExcalidrawMdGenerator()
    excalidraw_data = {
        "type": "excalidraw",
        "version": 2,
        "elements": [{"id": "test", "type": "freedraw"}],
        "appState": {},
        "files": {},
    }

    md = generator.generate(excalidraw_data)

    # 압축된 데이터는 원본 JSON과 다름
    assert '"type": "excalidraw"' not in md
    # compressed-json 블록 안에 데이터가 있음
    assert "```compressed-json" in md


def test_decompress_roundtrip():
    """압축 후 해제하면 원본 데이터 복원."""
    generator = ExcalidrawMdGenerator()
    original_data = {
        "type": "excalidraw",
        "version": 2,
        "elements": [{"id": "test123", "type": "freedraw", "x": 100, "y": 200}],
        "appState": {"viewBackgroundColor": "#ffffff"},
        "files": {},
    }

    md = generator.generate(original_data)

    # compressed-json 블록에서 압축된 데이터 추출
    import re
    match = re.search(r"```compressed-json\n(.+?)\n```", md, re.DOTALL)
    assert match is not None

    compressed = match.group(1)

    # 해제
    import lzstring
    lz = lzstring.LZString()
    decompressed = lz.decompressFromBase64(compressed)
    restored = json.loads(decompressed)

    assert restored == original_data
```

**Step 2: 테스트 실행 - 실패 확인**

Run: `pytest tests/test_excalidraw_md.py -v`
Expected: FAIL (모듈 없음)

**Step 3: Commit**

```bash
git add tests/test_excalidraw_md.py
git commit -m "test: ExcalidrawMdGenerator 테스트 추가"
```

---

## Task 6: Excalidraw Markdown 포맷 생성기 구현

**Files:**
- Create: `src/petrify_converter/excalidraw_md.py`

**Step 1: ExcalidrawMdGenerator 구현**

```python
# src/petrify_converter/excalidraw_md.py
import json
from typing import Any

import lzstring


class ExcalidrawMdGenerator:
    """Obsidian Excalidraw 플러그인용 .excalidraw.md 포맷 생성."""

    def generate(self, excalidraw_data: dict[str, Any]) -> str:
        """Excalidraw 데이터를 .excalidraw.md 포맷으로 변환."""
        compressed = self._compress(excalidraw_data)

        return f"""---
excalidraw-plugin: parsed
tags:
---

# Excalidraw Data

## Text Elements
## Embedded Files

%%
## Drawing
```compressed-json
{compressed}
```
%%
"""

    def _compress(self, data: dict[str, Any]) -> str:
        """Excalidraw 데이터를 LZString으로 압축."""
        json_str = json.dumps(data, ensure_ascii=False)
        lz = lzstring.LZString()
        return lz.compressToBase64(json_str)
```

**Step 2: 테스트 실행 - 통과 확인**

Run: `pytest tests/test_excalidraw_md.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/petrify_converter/excalidraw_md.py
git commit -m "feat: ExcalidrawMdGenerator 구현 (LZString 압축)"
```

---

## Task 7: Converter에서 .excalidraw.md 출력 지원

**Files:**
- Modify: `src/petrify_converter/converter.py`
- Modify: `tests/test_converter.py`

**Step 1: 테스트 추가**

`tests/test_converter.py`에 추가:

```python
def test_convert_to_excalidraw_md(examples_dir, tmp_path):
    """기본 출력이 .excalidraw.md 포맷."""
    output_path = tmp_path / "output.excalidraw.md"

    convert(examples_dir, output_path)

    assert output_path.exists()
    content = output_path.read_text()

    assert "excalidraw-plugin: parsed" in content
    assert "```compressed-json" in content


def test_convert_md_has_multiple_strokes(examples_dir, tmp_path):
    """변환 결과에 여러 스트로크가 포함됨."""
    import lzstring
    import re

    output_path = tmp_path / "output.excalidraw.md"
    convert(examples_dir, output_path)

    content = output_path.read_text()
    match = re.search(r"```compressed-json\n(.+?)\n```", content, re.DOTALL)
    assert match is not None

    lz = lzstring.LZString()
    decompressed = lz.decompressFromBase64(match.group(1))
    data = json.loads(decompressed)

    # 여러 스트로크가 있어야 함 (gap 분리 적용됨)
    assert len(data["elements"]) > 1
```

**Step 2: 테스트 실행 - 실패 확인**

Run: `pytest tests/test_converter.py::test_convert_to_excalidraw_md -v`
Expected: FAIL

**Step 3: converter.py 수정**

```python
import json
from pathlib import Path

from petrify_converter.excalidraw import ExcalidrawGenerator
from petrify_converter.excalidraw_md import ExcalidrawMdGenerator
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
        output_path: 출력 파일 경로 (.excalidraw.md 또는 .excalidraw)
        include_background: 배경 이미지 포함 여부
        stroke_color: 스트로크 색상 (기본: #000000)
        stroke_width: 스트로크 굵기 (기본: 1.0)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    parser = NoteParser(input_path)
    note = parser.parse()

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

    # 출력 포맷 결정
    if output_path.suffix == ".md" or output_path.name.endswith(".excalidraw.md"):
        md_generator = ExcalidrawMdGenerator()
        content = md_generator.generate(document)
        output_path.write_text(content, encoding="utf-8")
    else:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(document, f, ensure_ascii=False, indent=2)
```

**Step 4: 테스트 실행 - 통과 확인**

Run: `pytest tests/test_converter.py -v`
Expected: PASS

**Step 5: 전체 테스트 실행**

Run: `pytest -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/petrify_converter/converter.py tests/test_converter.py
git commit -m "feat: .excalidraw.md 출력 포맷 지원"
```

---

## Task 8: 기존 테스트 업데이트

**Files:**
- Modify: `tests/test_converter.py`
- Modify: `tests/test_integration.py`

기존 테스트가 새 로직과 호환되는지 확인하고 필요시 수정.

**Step 1: 전체 테스트 실행**

Run: `pytest -v`
Expected: 일부 실패 가능 (출력 포맷 변경으로)

**Step 2: 실패한 테스트 수정**

기존 `.excalidraw` 출력을 기대하는 테스트는 `.excalidraw.md`로 변경하거나, JSON 출력을 명시적으로 테스트.

**Step 3: 전체 테스트 통과 확인**

Run: `pytest -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: 기존 테스트를 새 출력 포맷에 맞게 업데이트"
```

---

## Task 9: 예시 파일 변환 및 검증

**Files:**
- None (수동 검증)

**Step 1: 예시 파일 변환**

```bash
python -c "
from petrify_converter import convert
convert('examples', '/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/viwoods-test.excalidraw.md')
print('Done')
"
```

**Step 2: Obsidian에서 열어서 확인**

- Obsidian에서 `viwoods-test.excalidraw.md` 열기
- 글씨가 제대로 보이는지 확인

**Step 3: 문제 있으면 수정, 없으면 완료**

---

## Task 10: 최종 커밋 및 정리

**Step 1: 버전 업데이트**

`pyproject.toml`과 `__init__.py`의 버전을 `0.2.0`으로 업데이트.

**Step 2: 최종 커밋**

```bash
git add .
git commit -m "release: v0.2.0 - 스트로크 분리 및 .excalidraw.md 출력 지원"
```
