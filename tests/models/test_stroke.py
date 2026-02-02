from petrify_converter.models import Point


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
