import pytest

from petrify_converter.exceptions import InvalidNoteFileError, ParseError


def test_invalid_note_file_error():
    with pytest.raises(InvalidNoteFileError) as exc_info:
        raise InvalidNoteFileError("not a zip file")

    assert "not a zip file" in str(exc_info.value)


def test_parse_error():
    with pytest.raises(ParseError) as exc_info:
        raise ParseError("invalid JSON")

    assert "invalid JSON" in str(exc_info.value)


def test_exceptions_inherit_from_exception():
    assert issubclass(InvalidNoteFileError, Exception)
    assert issubclass(ParseError, Exception)
