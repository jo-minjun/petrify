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


def test_stroke_width_scaling_constant_exists():
    """스케일링 상수가 정의되어 있는지 확인."""
    assert hasattr(ExcalidrawGenerator, 'STROKE_WIDTH_DIVISOR')
    assert ExcalidrawGenerator.STROKE_WIDTH_DIVISOR == 4


def test_stroke_width_min_constant_exists():
    """최소 굵기 상수가 정의되어 있는지 확인."""
    assert hasattr(ExcalidrawGenerator, 'MIN_STROKE_WIDTH')
    assert ExcalidrawGenerator.MIN_STROKE_WIDTH == 1


def test_scale_stroke_width_normal():
    """일반적인 굵기 스케일링."""
    generator = ExcalidrawGenerator()
    assert generator._scale_stroke_width(4) == 1
    assert generator._scale_stroke_width(8) == 2
    assert generator._scale_stroke_width(16) == 4
    assert generator._scale_stroke_width(74) == 18  # 74/4 = 18.5 -> 18


def test_scale_stroke_width_minimum():
    """최소값 1 보장."""
    generator = ExcalidrawGenerator()
    assert generator._scale_stroke_width(1) == 1
    assert generator._scale_stroke_width(2) == 1
    assert generator._scale_stroke_width(3) == 1


def test_scale_stroke_width_zero():
    """0 입력 시 최소값 반환."""
    generator = ExcalidrawGenerator()
    assert generator._scale_stroke_width(0) == 1


def test_create_freedraw_applies_scaling():
    """freedraw 생성 시 스케일링이 적용되는지 확인."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0), Point(x=10, y=10, timestamp=1)],
        color="#000000",
        width=20.0,  # 20px -> 20/4 = 5
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)
    assert element["strokeWidth"] == 5


def test_create_freedraw_minimum_width():
    """freedraw 생성 시 최소 굵기 보장."""
    generator = ExcalidrawGenerator()
    stroke = Stroke(
        points=[Point(x=0, y=0, timestamp=0)],
        color="#000000",
        width=2.0,  # 2px -> 2/4 = 0.5 -> 1 (최소값)
        opacity=100,
    )
    element = generator.create_freedraw(stroke, x_offset=0, y_offset=0)
    assert element["strokeWidth"] == 1
