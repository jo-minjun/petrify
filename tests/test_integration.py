# tests/test_integration.py
import json
from pathlib import Path

import pytest

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

    # 요소 타입 검증 (image 또는 freedraw)
    for element in data["elements"]:
        assert element["type"] in ("freedraw", "image")
        if element["type"] == "freedraw":
            assert "points" in element
            assert len(element["points"]) > 0
        elif element["type"] == "image":
            assert "fileId" in element


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


def test_various_text_color_extraction(tmp_path):
    """various_text 예시에서 색상이 올바르게 추출됨."""
    various_text_dir = Path(__file__).parent.parent / "examples/various_text/extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    output_path = tmp_path / "various_text_output.excalidraw"
    convert(various_text_dir, output_path)

    # 출력 파일 파싱
    with open(output_path) as f:
        content = f.read()

    # 형광펜 색상이 포함되어 있는지 확인
    assert "#ff00bc" in content.lower() or "#00b4fa" in content.lower()


def test_various_text_stroke_width_extraction(tmp_path):
    """various_text 예시에서 굵기가 올바르게 추출됨."""
    various_text_dir = Path(__file__).parent.parent / "examples/various_text/extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    output_path = tmp_path / "various_text_width.excalidraw"
    convert(various_text_dir, output_path)

    with open(output_path) as f:
        content = f.read()

    data = json.loads(content)

    # strokeWidth 값들 추출
    widths = [el.get("strokeWidth", 1) for el in data["elements"] if el["type"] == "freedraw"]

    # 다양한 굵기가 있어야 함
    assert len(set(widths)) > 1, f"모든 굵기가 동일: {set(widths)}"
    assert max(widths) > 10, f"형광펜 굵기가 없음: max={max(widths)}"
