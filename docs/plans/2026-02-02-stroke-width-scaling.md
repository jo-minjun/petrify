# Stroke Width Scaling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** mainBmp에서 측정된 픽셀 굵기를 Excalidraw strokeWidth로 스케일 변환하여 렌더링 품질 개선

**Architecture:** ColorExtractor에서 측정된 픽셀 값을 ÷4로 스케일링하고 최소값 1을 보장. 스케일링 로직은 ExcalidrawGenerator에서 적용 (측정과 변환 책임 분리).

**Tech Stack:** Python, pytest

---

### Task 1: ExcalidrawGenerator에 스케일링 상수 추가

**Files:**
- Modify: `src/petrify_converter/excalidraw.py:8-9`
- Test: `tests/test_excalidraw.py`

**Step 1: 테스트 작성**

`tests/test_excalidraw.py`에 추가:

```python
def test_stroke_width_scaling_constant_exists():
    """스케일링 상수가 정의되어 있는지 확인."""
    assert hasattr(ExcalidrawGenerator, 'STROKE_WIDTH_DIVISOR')
    assert ExcalidrawGenerator.STROKE_WIDTH_DIVISOR == 4

def test_stroke_width_min_constant_exists():
    """최소 굵기 상수가 정의되어 있는지 확인."""
    assert hasattr(ExcalidrawGenerator, 'MIN_STROKE_WIDTH')
    assert ExcalidrawGenerator.MIN_STROKE_WIDTH == 1
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_stroke_width_scaling_constant_exists tests/test_excalidraw.py::test_stroke_width_min_constant_exists -v`
Expected: FAIL with "AttributeError"

**Step 3: 구현**

`src/petrify_converter/excalidraw.py` 수정:

```python
class ExcalidrawGenerator:
    PAGE_GAP = 100
    STROKE_WIDTH_DIVISOR = 4
    MIN_STROKE_WIDTH = 1
```

**Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_stroke_width_scaling_constant_exists tests/test_excalidraw.py::test_stroke_width_min_constant_exists -v`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "feat: ExcalidrawGenerator에 스케일링 상수 추가"
```

---

### Task 2: 스케일링 메서드 추가

**Files:**
- Modify: `src/petrify_converter/excalidraw.py`
- Test: `tests/test_excalidraw.py`

**Step 1: 테스트 작성**

`tests/test_excalidraw.py`에 추가:

```python
def test_scale_stroke_width_normal():
    """일반적인 굵기 스케일링."""
    generator = ExcalidrawGenerator()
    assert generator._scale_stroke_width(4) == 1
    assert generator._scale_stroke_width(8) == 2
    assert generator._scale_stroke_width(16) == 4
    assert generator._scale_stroke_width(74) == 18  # 74/4 = 18.5 -> 18

def test_scale_stroke_width_minimum():
    """최소값 1 보장."""
    generator = ExcalidrawGenerator()
    assert generator._scale_stroke_width(1) == 1
    assert generator._scale_stroke_width(2) == 1
    assert generator._scale_stroke_width(3) == 1

def test_scale_stroke_width_zero():
    """0 입력 시 최소값 반환."""
    generator = ExcalidrawGenerator()
    assert generator._scale_stroke_width(0) == 1
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_scale_stroke_width_normal tests/test_excalidraw.py::test_scale_stroke_width_minimum tests/test_excalidraw.py::test_scale_stroke_width_zero -v`
Expected: FAIL with "AttributeError: '_scale_stroke_width'"

**Step 3: 구현**

`src/petrify_converter/excalidraw.py`에 메서드 추가:

```python
def _scale_stroke_width(self, width: float) -> int:
    """mainBmp 픽셀 굵기를 Excalidraw strokeWidth로 스케일링."""
    scaled = int(width / self.STROKE_WIDTH_DIVISOR)
    return max(self.MIN_STROKE_WIDTH, scaled)
```

**Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_scale_stroke_width_normal tests/test_excalidraw.py::test_scale_stroke_width_minimum tests/test_excalidraw.py::test_scale_stroke_width_zero -v`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "feat: 스케일링 메서드 _scale_stroke_width 추가"
```

---

### Task 3: freedraw 생성 시 스케일링 적용

**Files:**
- Modify: `src/petrify_converter/excalidraw.py:83`
- Test: `tests/test_excalidraw.py`

**Step 1: 테스트 작성**

`tests/test_excalidraw.py`에 추가:

```python
def test_create_freedraw_applies_scaling():
    """freedraw 생성 시 스케일링이 적용되는지 확인."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0), Point(x=10, y=10, timestamp=1)],
        color="#000000",
        width=20.0,  # 20px -> 20/4 = 5
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)
    assert element["strokeWidth"] == 5

def test_create_freedraw_minimum_width():
    """freedraw 생성 시 최소 굵기 보장."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0)],
        color="#000000",
        width=2.0,  # 2px -> 2/4 = 0.5 -> 1 (최소값)
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)
    assert element["strokeWidth"] == 1
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_create_freedraw_applies_scaling tests/test_excalidraw.py::test_create_freedraw_minimum_width -v`
Expected: FAIL (현재 strokeWidth가 20, 2로 나옴)

**Step 3: 구현**

`src/petrify_converter/excalidraw.py`의 `_create_freedraw_element` 메서드에서 83번째 줄 수정:

```python
# 변경 전:
"strokeWidth": int(stroke.width),

# 변경 후:
"strokeWidth": self._scale_stroke_width(stroke.width),
```

**Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_create_freedraw_applies_scaling tests/test_excalidraw.py::test_create_freedraw_minimum_width -v`
Expected: PASS

**Step 5: 전체 테스트 실행**

Run: `.venv/bin/pytest -v`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "feat: freedraw 생성 시 strokeWidth 스케일링 적용"
```

---

### Task 4: 실제 파일로 검증

**Files:**
- None (수동 검증)

**Step 1: 변환 실행**

```bash
.venv/bin/python -c "
from pathlib import Path
from petrify_converter import convert

convert(
    Path('examples/various_text/various_text.note'),
    Path('/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_scaled.excalidraw.md')
)
print('Done')
"
```

**Step 2: Obsidian에서 결과 확인**

- `various_text_scaled.excalidraw.md` 파일을 Obsidian에서 열기
- 원본 mainBmp 이미지와 비교하여 굵기가 적절한지 확인
- 가는 볼펜: strokeWidth 1-2
- 굵은 볼펜: strokeWidth 4-7
- 형광펜: strokeWidth 8-19

**Step 3: 필요시 STROKE_WIDTH_DIVISOR 조정**

비율이 맞지 않으면 `STROKE_WIDTH_DIVISOR` 값을 3, 5 등으로 조정 후 다시 확인
