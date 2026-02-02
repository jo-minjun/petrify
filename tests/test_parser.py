import pytest
from pathlib import Path

from petrify_converter.parser import NoteParser
from petrify_converter.exceptions import InvalidNoteFileError


def test_parser_with_invalid_file(tmp_path):
    invalid_file = tmp_path / "invalid.note"
    invalid_file.write_text("not a zip file")

    parser = NoteParser(invalid_file)

    with pytest.raises(InvalidNoteFileError):
        parser.parse()


def test_parser_with_nonexistent_file():
    with pytest.raises(FileNotFoundError):
        NoteParser(Path("/nonexistent/file.note"))


def test_parser_extracts_files(examples_dir):
    parser = NoteParser(examples_dir)

    assert parser._find_path_files() is not None


def test_parser_splits_strokes_by_timestamp(examples_dir):
    """Parser가 timestamp gap 기준으로 스트로크를 분리."""
    parser = NoteParser(examples_dir)
    note = parser.parse()

    # examples 데이터는 여러 스트로크로 분리되어야 함
    total_strokes = sum(len(page.strokes) for page in note.pages)
    assert total_strokes > 1


def test_parser_extracts_stroke_colors():
    """스트로크 색상이 mainBmp에서 추출됨."""
    various_text_dir = Path(__file__).parent.parent / "examples" / "various_text" / "extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    parser = NoteParser(various_text_dir)
    note = parser.parse()

    # 색상이 추출되었는지 확인
    colors = set(stroke.color for page in note.pages for stroke in page.strokes)

    # 검정색 외에 다른 색상도 있어야 함
    assert len(colors) > 1


def test_parser_extracts_stroke_opacity():
    """스트로크 투명도가 mainBmp에서 추출됨."""
    various_text_dir = Path(__file__).parent.parent / "examples" / "various_text" / "extracted"
    if not various_text_dir.exists():
        pytest.skip("various_text example not found")

    parser = NoteParser(various_text_dir)
    note = parser.parse()

    # 투명도 값 확인
    opacities = set(stroke.opacity for page in note.pages for stroke in page.strokes)

    # 기본값(100) 외에 다른 투명도도 있을 수 있음
    assert all(0 <= o <= 100 for o in opacities)
