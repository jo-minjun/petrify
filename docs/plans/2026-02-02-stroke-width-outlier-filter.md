# Stroke Width Outlier Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 굵기 측정 시 IQR 기반 이상치 필터링을 적용하여 스트로크 간 굵기 균일도 개선

**Architecture:** ColorExtractor.extract_stroke_width 메서드에서 각 포인트별 굵기를 측정한 후, IQR(Interquartile Range) 기반으로 이상치를 제거하고 나머지 값들의 median을 반환. 이상치 제거 로직은 별도 private 메서드로 분리.

**Tech Stack:** Python, pytest, statistics 모듈

---

### Task 1: 이상치 필터링 메서드 추가

**Files:**
- Modify: `src/petrify_converter/color_extractor.py`
- Test: `tests/test_color_extractor.py`

**Step 1: 테스트 작성**

`tests/test_color_extractor.py`에 추가:

```python
def test_filter_outliers_removes_high_values():
    """IQR 기반으로 높은 이상치가 제거되는지 확인."""
    extractor = ColorExtractor(create_test_image())
    # 정상 값들 + 이상치
    values = [5, 6, 5, 7, 6, 5, 6, 50]  # 50은 이상치
    filtered = extractor._filter_outliers(values)
    assert 50 not in filtered
    assert len(filtered) == 7

def test_filter_outliers_keeps_normal_values():
    """정상 범위 값들은 유지되는지 확인."""
    extractor = ColorExtractor(create_test_image())
    values = [5, 6, 7, 8, 6, 7, 5, 6]
    filtered = extractor._filter_outliers(values)
    assert filtered == values

def test_filter_outliers_with_few_values():
    """값이 적을 때 (4개 미만) 필터링하지 않음."""
    extractor = ColorExtractor(create_test_image())
    values = [5, 50, 6]
    filtered = extractor._filter_outliers(values)
    assert filtered == values  # 그대로 반환
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `.venv/bin/pytest tests/test_color_extractor.py::test_filter_outliers_removes_high_values tests/test_color_extractor.py::test_filter_outliers_keeps_normal_values tests/test_color_extractor.py::test_filter_outliers_with_few_values -v`
Expected: FAIL with "AttributeError: '_filter_outliers'"

**Step 3: 구현**

`src/petrify_converter/color_extractor.py`에 메서드 추가:

```python
def _filter_outliers(self, values: list[int]) -> list[int]:
    """IQR 기반으로 이상치 제거.

    Args:
        values: 측정된 굵기 값들

    Returns:
        이상치가 제거된 값들. 4개 미만이면 그대로 반환.
    """
    if len(values) < 4:
        return values

    sorted_vals = sorted(values)
    q1_idx = len(sorted_vals) // 4
    q3_idx = 3 * len(sorted_vals) // 4
    q1 = sorted_vals[q1_idx]
    q3 = sorted_vals[q3_idx]
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    return [v for v in values if lower <= v <= upper]
```

**Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/test_color_extractor.py::test_filter_outliers_removes_high_values tests/test_color_extractor.py::test_filter_outliers_keeps_normal_values tests/test_color_extractor.py::test_filter_outliers_with_few_values -v`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "feat: IQR 기반 이상치 필터링 메서드 추가"
```

---

### Task 2: extract_stroke_width에 이상치 필터링 적용

**Files:**
- Modify: `src/petrify_converter/color_extractor.py`
- Test: `tests/test_color_extractor.py`

**Step 1: 테스트 작성**

`tests/test_color_extractor.py`에 추가:

```python
def test_extract_stroke_width_filters_outliers():
    """extract_stroke_width가 이상치를 필터링하는지 확인."""
    # 이 테스트는 실제 이미지로 검증하기 어려우므로,
    # _filter_outliers가 호출되는지 간접적으로 확인
    # 또는 모킹을 사용
    pass  # 통합 테스트로 대체
```

실제로는 기존 테스트가 통과하는지 확인하면 됨.

**Step 2: 구현**

`src/petrify_converter/color_extractor.py`의 `extract_stroke_width` 메서드 수정:

```python
def extract_stroke_width(self, points: list[list]) -> int:
    """스트로크 포인트들의 대표 굵기 추출 (이상치 제거 후 중앙값).

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

    # 이상치 필터링 적용
    filtered = self._filter_outliers(widths)
    if not filtered:
        return 1

    return int(median(filtered))
```

**Step 3: 전체 테스트 실행**

Run: `.venv/bin/pytest -v`
Expected: ALL PASS

**Step 4: 커밋**

```bash
git add src/petrify_converter/color_extractor.py
git commit -m "feat: extract_stroke_width에 이상치 필터링 적용"
```

---

### Task 3: 실제 파일로 검증

**Files:**
- None (수동 검증)

**Step 1: 변환 실행**

```bash
.venv/bin/python -c "
from pathlib import Path
from petrify_converter import convert

convert(
    Path('examples/various_text/various_text.note'),
    Path('/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_v3.excalidraw.md')
)
print('Done')
"
```

**Step 2: Obsidian에서 결과 확인**

- `various_text_v3.excalidraw.md` 파일을 Obsidian에서 열기
- 원본 mainBmp 이미지와 비교

**체크리스트:**
- [ ] 굵은 글씨의 굵기가 균일한가?
- [ ] 캘리그라피 '간' 글자의 굵기가 균일한가?
- [ ] 형광펜의 시작/끝과 중간 굵기가 균일한가?
- [ ] 첫번째 글씨는 여전히 잘 보이는가? (기존 만족 상태 유지)

**Step 3: 문제 시 디버깅**

이상치 필터링 전후 값 비교:

```bash
.venv/bin/python -c "
import sys
sys.path.insert(0, 'src')
from pathlib import Path
import zipfile
import tempfile
import json
from statistics import median
from petrify_converter.color_extractor import ColorExtractor

note_path = Path('examples/various_text/various_text.note')
with zipfile.ZipFile(note_path, 'r') as zf:
    with tempfile.TemporaryDirectory() as tmpdir:
        zf.extractall(tmpdir)
        tmpdir = Path(tmpdir)
        mainbmp = list(tmpdir.glob('mainBmp_*.png'))[0]
        extractor = ColorExtractor(mainbmp.read_bytes())

        path_file = list(tmpdir.glob('path_*.json'))[0]
        data = json.loads(path_file.read_text())

        # 형광펜 영역 (마지막 부분)
        blue_points = []
        for p in sorted(data, key=lambda x: x[2]):
            x, y = int(p[0]), int(p[1])
            color, _ = extractor.get_color_at(x, y)
            if '#00b' in color.lower():
                w = extractor.get_width_at(x, y)
                blue_points.append(w)

        if blue_points:
            filtered = extractor._filter_outliers(blue_points)
            print(f'파란 형광펜 측정값: {blue_points}')
            print(f'필터링 후: {filtered}')
            print(f'원본 median: {median(blue_points)}, 필터 후 median: {median(filtered) if filtered else 0}')
"
```
