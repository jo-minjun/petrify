# Stroke Rendering Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스트로크 렌더링 품질 개선 - simulatePressure 비활성화로 균일한 굵기, 스케일링 비율 조정으로 원본 대비 굵기 정확도 향상

**Architecture:**
1. ExcalidrawGenerator에서 simulatePressure: false로 변경하여 Excalidraw의 압력 시뮬레이션으로 인한 굵기 불균일 해결
2. STROKE_WIDTH_DIVISOR를 4에서 6으로 변경하여 전체적인 굵기를 원본에 가깝게 조정

**Tech Stack:** Python, pytest

---

### Task 1: simulatePressure를 false로 변경

**Files:**
- Modify: `src/petrify_converter/excalidraw.py:92`
- Test: `tests/test_excalidraw.py`

**Step 1: 기존 테스트 확인**

현재 simulatePressure 관련 테스트가 있는지 확인. 없으면 테스트 추가:

```python
def test_freedraw_simulate_pressure_disabled():
    """simulatePressure가 비활성화되어 있는지 확인."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0), Point(x=10, y=10, timestamp=1)],
        color="#000000",
        width=8.0,
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)
    assert element["simulatePressure"] == False
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_freedraw_simulate_pressure_disabled -v`
Expected: FAIL (현재 True로 설정됨)

**Step 3: 구현**

`src/petrify_converter/excalidraw.py`의 `_create_freedraw_element` 메서드에서 수정:

```python
# 변경 전 (약 92번째 줄):
"simulatePressure": True,

# 변경 후:
"simulatePressure": False,
```

**Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py::test_freedraw_simulate_pressure_disabled -v`
Expected: PASS

**Step 5: 커밋**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "fix: simulatePressure 비활성화로 굵기 균일화"
```

---

### Task 2: 스케일링 비율 조정 (÷4 → ÷6)

**Files:**
- Modify: `src/petrify_converter/excalidraw.py:10`
- Test: `tests/test_excalidraw.py`

**Step 1: 상수 테스트 수정**

`tests/test_excalidraw.py`에서 기존 테스트 수정:

```python
def test_stroke_width_scaling_constant_exists():
    """스케일링 상수가 정의되어 있는지 확인."""
    assert hasattr(ExcalidrawGenerator, 'STROKE_WIDTH_DIVISOR')
    assert ExcalidrawGenerator.STROKE_WIDTH_DIVISOR == 6  # 4에서 6으로 변경
```

**Step 2: 스케일링 메서드 테스트 수정**

```python
def test_scale_stroke_width_normal():
    """일반적인 굵기 스케일링."""
    generator = ExcalidrawGenerator()
    # ÷6 기준으로 수정
    assert generator._scale_stroke_width(6) == 1
    assert generator._scale_stroke_width(12) == 2
    assert generator._scale_stroke_width(18) == 3
    assert generator._scale_stroke_width(74) == 12  # 74/6 = 12.3 -> 12
```

**Step 3: freedraw 스케일링 테스트 수정**

```python
def test_create_freedraw_applies_scaling():
    """freedraw 생성 시 스케일링이 적용되는지 확인."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0), Point(x=10, y=10, timestamp=1)],
        color="#000000",
        width=18.0,  # 18px -> 18/6 = 3
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)
    assert element["strokeWidth"] == 3
```

**Step 4: 테스트 실행하여 실패 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py -v`
Expected: FAIL (현재 DIVISOR가 4)

**Step 5: 구현**

`src/petrify_converter/excalidraw.py` 수정:

```python
class ExcalidrawGenerator:
    PAGE_GAP = 100
    STROKE_WIDTH_DIVISOR = 6  # 4에서 6으로 변경
    MIN_STROKE_WIDTH = 1
```

**Step 6: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/test_excalidraw.py -v`
Expected: PASS

**Step 7: 전체 테스트 실행**

Run: `.venv/bin/pytest -v`
Expected: ALL PASS (다른 테스트에서 stroke_width 관련 값 수정 필요할 수 있음)

**Step 8: 커밋**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py tests/test_converter.py
git commit -m "fix: 스케일링 비율 조정 (÷4 → ÷6)으로 굵기 정확도 개선"
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
    Path('/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_v2.excalidraw.md')
)
print('Done')
"
```

**Step 2: Obsidian에서 결과 확인**

- `various_text_v2.excalidraw.md` 파일을 Obsidian에서 열기
- 원본 mainBmp 이미지와 비교

**체크리스트:**
- [ ] 형광펜 굵기가 균일한가? (simulatePressure 효과)
- [ ] 굵은 글씨가 원본과 비슷한 굵기인가? (이전 1.5배 → 1.0배 목표)
- [ ] 파란 형광펜이 원본과 비슷한 굵기인가? (이전 1.2~1.3배 → 1.0배 목표)
- [ ] 첫번째 글씨의 ㅉ, ㅆ가 갑자기 굵어지지 않는가?

**Step 3: 예상 굵기 비교**

| 구분 | 원본 | ÷4 스케일 | ÷6 스케일 (새로운) |
|------|------|----------|------------------|
| 가는 볼펜 (5-8px) | - | 1-2 | 1 |
| 굵은 볼펜 (16-26px) | - | 4-6 | 2-4 |
| 파란 형광펜 (74px) | - | 18 | 12 |
| 분홍 형광펜 (30px) | - | 7 | 5 |

**Step 4: 필요시 추가 조정**

비율이 여전히 맞지 않으면:
- STROKE_WIDTH_DIVISOR를 5, 7 등으로 미세 조정
- 또는 이상치 필터링 로직 추가 검토
