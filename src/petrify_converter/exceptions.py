class PetrifyError(Exception):
    """Base exception for petrify-converter."""

    pass


class InvalidNoteFileError(PetrifyError):
    """Raised when the note file is invalid."""

    pass


class ParseError(PetrifyError):
    """Raised when parsing fails."""

    pass
