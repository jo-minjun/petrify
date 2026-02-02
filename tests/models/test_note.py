from datetime import datetime

from petrify_converter.models import Note, Page


def test_note_creation():
    page = Page(id="page-1", strokes=[])
    created = datetime(2026, 1, 30, 10, 39)
    modified = datetime(2026, 2, 1, 12, 0)

    note = Note(
        title="테스트 노트",
        pages=[page],
        created_at=created,
        modified_at=modified,
    )

    assert note.title == "테스트 노트"
    assert len(note.pages) == 1
    assert note.created_at == created
    assert note.modified_at == modified


def test_note_multiple_pages():
    pages = [Page(id=f"page-{i}", strokes=[]) for i in range(3)]
    note = Note(
        title="멀티 페이지",
        pages=pages,
        created_at=datetime.now(),
        modified_at=datetime.now(),
    )

    assert len(note.pages) == 3
