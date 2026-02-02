from petrify_converter.models import Page, Point, Stroke


def test_page_creation():
    stroke = Stroke(points=[Point(0, 0, 0)])
    page = Page(id="page-1", strokes=[stroke])

    assert page.id == "page-1"
    assert len(page.strokes) == 1
    assert page.width == 1440.0
    assert page.height == 1920.0


def test_page_custom_dimensions():
    page = Page(id="page-1", strokes=[], width=800.0, height=600.0)

    assert page.width == 800.0
    assert page.height == 600.0
