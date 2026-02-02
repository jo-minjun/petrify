# tests/test_excalidraw_md.py
import json
import re

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
    import lzstring

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
    match = re.search(r"```compressed-json\n(.+?)\n```", md, re.DOTALL)
    assert match is not None

    compressed = match.group(1)

    # 해제
    lz = lzstring.LZString()
    decompressed = lz.decompressFromBase64(compressed)
    restored = json.loads(decompressed)

    assert restored == original_data
