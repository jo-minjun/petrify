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
