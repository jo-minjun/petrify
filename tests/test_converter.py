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
