import json

from petrify_converter.excalidraw import ExcalidrawGenerator
from petrify_converter.models import Point, Stroke, Page, Note
from datetime import datetime


def test_generate_freedraw_element():
    points = [Point(0, 0, 0), Point(10, 5, 1), Point(20, 10, 2)]
    stroke = Stroke(points=points, color="#000000", width=1.0)

    generator = ExcalidrawGenerator()
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)

    assert element["type"] == "freedraw"
    assert element["strokeColor"] == "#000000"
    assert element["strokeWidth"] == 1
    assert len(element["points"]) == 3
    assert element["points"][0] == [0, 0]


def test_freedraw_element_has_required_fields():
    stroke = Stroke(points=[Point(0, 0, 0)], color="#ff0000", width=2.0)

    generator = ExcalidrawGenerator()
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)

    required_fields = [
        "type", "id", "x", "y", "width", "height",
        "strokeColor", "strokeWidth", "points",
        "opacity", "roughness", "seed",
    ]

    for field in required_fields:
        assert field in element, f"Missing field: {field}"


def test_freedraw_with_opacity():
    """투명도가 있는 freedraw 요소 생성."""
    points = [Point(0, 0, 1), Point(10, 10, 2)]
    stroke = Stroke(points=points, color="#ff00bc", opacity=50)

    generator = ExcalidrawGenerator()
    element = generator.create_freedraw(stroke, 0, 0)

    assert element["strokeColor"] == "#ff00bc"
    assert element["opacity"] == 50


def test_generate_full_document():
    page = Page(
        id="page-1",
        strokes=[Stroke(points=[Point(0, 0, 0), Point(10, 10, 1)])],
    )
    note = Note(
        title="Test",
        pages=[page],
        created_at=datetime.now(),
        modified_at=datetime.now(),
    )

    generator = ExcalidrawGenerator()
    doc = generator.generate(note)

    assert doc["type"] == "excalidraw"
    assert doc["version"] == 2
    assert "elements" in doc
    assert "appState" in doc
