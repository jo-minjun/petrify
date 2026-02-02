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
        stroke_width=8,  # 8px -> 8/4 = 2 (스케일링 적용됨)
    )

    with open(output_path) as f:
        data = json.load(f)

    freedraw_elements = [e for e in data["elements"] if e["type"] == "freedraw"]
    if freedraw_elements:
        assert freedraw_elements[0]["strokeColor"] == "#ff0000"
        assert freedraw_elements[0]["strokeWidth"] == 2


def test_convert_nonexistent_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        convert(tmp_path / "nonexistent.note", tmp_path / "output.excalidraw")


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
