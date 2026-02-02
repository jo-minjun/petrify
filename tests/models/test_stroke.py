from petrify_converter.models import Point, Stroke


def test_point_creation():
    point = Point(x=100.0, y=200.0, timestamp=1234567890)

    assert point.x == 100.0
    assert point.y == 200.0
    assert point.timestamp == 1234567890


def test_point_from_list():
    point = Point.from_list([100, 200, 1234567890])

    assert point.x == 100.0
    assert point.y == 200.0
    assert point.timestamp == 1234567890


def test_stroke_creation():
    points = [Point(0, 0, 0), Point(10, 10, 1)]
    stroke = Stroke(points=points)

    assert len(stroke.points) == 2
    assert stroke.color == "#000000"
    assert stroke.width == 1.0


def test_stroke_custom_style():
    points = [Point(0, 0, 0)]
    stroke = Stroke(points=points, color="#ff0000", width=2.5)

    assert stroke.color == "#ff0000"
    assert stroke.width == 2.5


def test_stroke_from_path_data():
    path_data = [[0, 0, 100], [10, 5, 101], [20, 10, 102]]
    stroke = Stroke.from_path_data(path_data)

    assert len(stroke.points) == 3
    assert stroke.points[0].x == 0
    assert stroke.points[2].y == 10
