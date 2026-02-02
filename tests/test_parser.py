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
