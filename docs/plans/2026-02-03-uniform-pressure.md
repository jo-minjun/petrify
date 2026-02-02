# Uniform Pressure 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** freedraw 요소의 pressures 배열에 균일한 값(1.0)을 채워서 스트로크 시작/끝 테이퍼링 방지

**Architecture:** `_create_freedraw_element` 메서드에서 빈 pressures 배열 대신 포인트 개수만큼 1.0으로 채운 배열 생성

**Tech Stack:** Python, pytest

---

### Task 1: pressures 배열 균일값 채우기

**Files:**
- Modify: `src/petrify_converter/excalidraw.py:91`
- Test: `tests/test_excalidraw.py`

**Step 1: 실패하는 테스트 작성**

```python
def test_freedraw_pressures_filled():
    """pressures 배열이 포인트 개수만큼 1.0으로 채워지는지 확인."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0), Point(x=10, y=10, timestamp=1), Point(x=20, y=20, timestamp=2)],
        color="#000000",
        width=8.0,
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)

    assert element["pressures"] == [1.0, 1.0, 1.0]
```

**Step 2: 테스트 실패 확인**

Run: `source .venv/bin/activate && pytest tests/test_excalidraw.py::test_freedraw_pressures_filled -v`
Expected: FAIL - `assert [] == [1.0, 1.0, 1.0]`

**Step 3: 구현**

`src/petrify_converter/excalidraw.py` 수정:

```python
# line 91 변경
"pressures": [],
# ↓
"pressures": [1.0] * len(points),
```

**Step 4: 테스트 통과 확인**

Run: `source .venv/bin/activate && pytest tests/test_excalidraw.py::test_freedraw_pressures_filled -v`
Expected: PASS

**Step 5: 전체 테스트 통과 확인**

Run: `source .venv/bin/activate && pytest tests/test_excalidraw.py -v`
Expected: All PASS

**Step 6: 커밋**

```bash
git add src/petrify_converter/excalidraw.py tests/test_excalidraw.py
git commit -m "$(cat <<'EOF'
feat: pressures 배열에 균일값 채워 테이퍼링 방지

빈 pressures 배열 대신 포인트 개수만큼 1.0으로 채워서
스트로크 시작/끝의 불균일한 굵기 렌더링 방지

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 변환 후 검증

**Step 1: various_text 변환**

Run: `source .venv/bin/activate && python scripts/convert.py examples/various_text/various_text.note "/Users/minjun.jo/Documents/Obsidian Vault/Excalidraw/various_text_v8.excalidraw.md"`

**Step 2: Obsidian에서 결과 확인**

사용자가 `various_text_v8.excalidraw.md`를 열어 형광펜 시작점이 균일하게 표시되는지 확인
