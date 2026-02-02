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
