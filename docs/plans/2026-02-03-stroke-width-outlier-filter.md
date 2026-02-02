# Stroke Width Outlier Filter 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 교차점에서 과대측정되는 굵기값(outlier)을 급격한 변화 감지로 필터링

**Architecture:** 정렬된 widths 배열에서 이전 값 대비 1.5배 이상 증가하는 지점을 찾아 그 이전 값들만 사용하여 대표 굵기 계산

**Tech Stack:** Python, pytest, PIL

---

### Task 1: 급격한 변화 감지로 outlier 필터링

**Files:**
- Modify: `src/petrify_converter/color_extractor.py:60-85`
- Test: `tests/test_color_extractor.py`

**Step 1: 실패하는 테스트 작성**

`tests/test_color_extractor.py` 끝에 추가:

```python
def test_extract_stroke_width_filters_outliers():
    """교차점 outlier를 급격한 변화 감지로 필터링."""
    # 20x20 이미지
    img = Image.new('RGBA', (20, 20), (0, 0, 0, 0))

    # 왼쪽: 3px 굵기 수직선 (x=2~4)
    for y in range(20):
        for x in range(2, 5):
            img.putpixel((x, y), (0, 0, 0, 255))

    # 오른쪽: 7px 굵기 수직선 (x=10~16) - 교차점 시뮬레이션
    for y in range(20):
        for x in range(10, 17):
            img.putpixel((x, y), (0, 0, 0, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    # 5개 포인트: 3px 2개, 7px 3개 (교차점처럼 큰 값이 많음)
    # widths: [3, 3, 7, 7, 7] -> sorted: [3, 3, 7, 7, 7]
    # 3 → 7: 2.33배 증가 (급격한 변화) -> filtered: [3, 3]
    # 결과: 3
    points = [
        [3, 5, 1], [3, 15, 2],       # 3px 영역
        [13, 5, 3], [13, 10, 4], [13, 15, 5],  # 7px 영역 (교차점)
    ]
    width = extractor.extract_stroke_width(points)

    assert width == 3  # outlier 필터링 후 결과
```

**Step 2: 테스트 실패 확인**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py::test_extract_stroke_width_filters_outliers -v`

Expected: FAIL - `assert 3 == 3` 또는 다른 값 (현재 로직은 하위 20%인 3을 반환할 수 있으므로 더 명확한 테스트 필요)

**Step 3: 더 명확한 테스트로 수정**

테스트를 더 명확하게 수정 - 현재 로직과 새 로직의 차이가 드러나도록:

```python
def test_extract_stroke_width_filters_outliers():
    """교차점 outlier를 급격한 변화 감지로 필터링."""
    # 30x20 이미지
    img = Image.new('RGBA', (30, 20), (0, 0, 0, 0))

    # 왼쪽: 4px 굵기 수직선 (x=2~5)
    for y in range(20):
        for x in range(2, 6):
            img.putpixel((x, y), (0, 0, 0, 255))

    # 중간: 5px 굵기 수직선 (x=10~14)
    for y in range(20):
        for x in range(10, 15):
            img.putpixel((x, y), (0, 0, 0, 255))

    # 오른쪽: 12px 굵기 수직선 (x=18~29) - 교차점 시뮬레이션
    for y in range(20):
        for x in range(18, 30):
            img.putpixel((x, y), (0, 0, 0, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    # 5개 포인트: widths [4, 5, 12, 12, 12]
    # sorted: [4, 5, 12, 12, 12]
    # 현재 로직: idx=5//5=1 -> 5 반환
    # 새 로직: 5 → 12는 2.4배 -> filtered: [4, 5] -> idx=2//5=0 -> 4 반환
    points = [
        [3, 10, 1],       # 4px 영역
        [12, 10, 2],      # 5px 영역
        [24, 5, 3], [24, 10, 4], [24, 15, 5],  # 12px 영역 (교차점)
    ]
    width = extractor.extract_stroke_width(points)

    assert width == 4  # outlier 필터링 후: [4, 5] -> 하위 20% = 4
```

**Step 4: 테스트 실패 확인**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py::test_extract_stroke_width_filters_outliers -v`

Expected: FAIL - `assert 5 == 4` (현재 로직은 5 반환)

**Step 5: 구현**

`src/petrify_converter/color_extractor.py` 수정:

```python
def extract_stroke_width(self, points: list[list]) -> int:
    """스트로크 포인트들의 대표 굵기 추출 (outlier 필터링 + 하위 20%).

    - 정렬된 배열에서 급격한 변화(1.5배 이상)가 시작되는 지점 이전까지만 사용
    - 교차점에서 과대측정된 값을 효과적으로 제거

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

    sorted_widths = sorted(widths)
    filtered = self._filter_outliers(sorted_widths)

    idx = len(filtered) // 5
    return filtered[idx]

def _filter_outliers(self, sorted_widths: list[int]) -> list[int]:
    """급격한 변화(1.5배 이상)가 시작되는 지점 이전까지 필터링."""
    if len(sorted_widths) <= 1:
        return sorted_widths

    filtered = [sorted_widths[0]]
    for i in range(1, len(sorted_widths)):
        if sorted_widths[i] > sorted_widths[i - 1] * 1.5:
            break
        filtered.append(sorted_widths[i])

    return filtered
```

**Step 6: 테스트 통과 확인**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py::test_extract_stroke_width_filters_outliers -v`

Expected: PASS

**Step 7: 전체 테스트 통과 확인**

Run: `source .venv/bin/activate && pytest tests/test_color_extractor.py -v`

Expected: All PASS

**Step 8: 커밋**

```bash
git add src/petrify_converter/color_extractor.py tests/test_color_extractor.py
git commit -m "$(cat <<'EOF'
fix: 교차점 outlier 필터링으로 굵기 과대측정 방지

정렬된 widths 배열에서 이전 값 대비 1.5배 이상 증가하는
지점을 감지하여 교차점에서 과대측정된 값을 필터링

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 변환 후 검증

**Step 1: various_text 변환**

Run: `source .venv/bin/activate && python scripts/convert.py examples/various_text/various_text.note "/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_v10.excalidraw.md"`

**Step 2: Obsidian에서 결과 확인**

사용자가 `various_text_v10.excalidraw.md`를 열어 '캘' 글자의 ㅐ 가로획이 정상 굵기로 표시되는지 확인
