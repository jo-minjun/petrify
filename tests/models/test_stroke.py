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


def test_split_strokes_by_timestamp_gap():
    """gap >= 6 기준으로 스트로크 분리."""
    # 두 개의 스트로크: ts 1-5, ts 11-15 (gap=6)
    data = [
        [100, 100, 1],
        [101, 101, 2],
        [102, 102, 3],
        [103, 103, 4],
        [104, 104, 5],
        # gap = 6 (11 - 5 = 6)
        [200, 200, 11],
        [201, 201, 12],
        [202, 202, 13],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    assert len(strokes) == 2
    assert len(strokes[0].points) == 5
    assert len(strokes[1].points) == 3
    assert strokes[0].points[0].x == 100
    assert strokes[1].points[0].x == 200


def test_split_strokes_sorts_by_timestamp():
    """timestamp 순서로 정렬 후 분리."""
    data = [
        [200, 200, 11],
        [100, 100, 1],
        [101, 101, 2],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    assert len(strokes) == 2
    assert strokes[0].points[0].timestamp == 1
    assert strokes[0].points[1].timestamp == 2
    assert strokes[1].points[0].timestamp == 11


def test_split_strokes_single_stroke():
    """gap이 threshold 미만이면 하나의 스트로크."""
    data = [
        [100, 100, 1],
        [101, 101, 2],
        [102, 102, 3],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6)

    assert len(strokes) == 1
    assert len(strokes[0].points) == 3


def test_split_strokes_empty_data():
    """빈 데이터는 빈 리스트 반환."""
    strokes = Stroke.split_by_timestamp_gap([], gap_threshold=6)

    assert len(strokes) == 0


def test_stroke_with_opacity():
    """투명도가 있는 스트로크 생성."""
    points = [Point(0, 0, 1), Point(10, 10, 2)]
    stroke = Stroke(points=points, color="#ff00bc", width=5.0, opacity=50)

    assert stroke.opacity == 50


def test_stroke_default_opacity():
    """기본 투명도는 100."""
    points = [Point(0, 0, 1)]
    stroke = Stroke(points=points)

    assert stroke.opacity == 100


def test_stroke_from_path_data_with_opacity():
    """from_path_data에서 opacity 파라미터 전달."""
    path_data = [[0, 0, 100], [10, 5, 101]]
    stroke = Stroke.from_path_data(path_data, color="#ff0000", width=2.0, opacity=75)

    assert stroke.opacity == 75
    assert stroke.color == "#ff0000"
    assert stroke.width == 2.0


def test_split_strokes_with_opacity():
    """split_by_timestamp_gap에서 opacity 파라미터 전달."""
    data = [
        [100, 100, 1],
        [101, 101, 2],
        [200, 200, 11],
    ]

    strokes = Stroke.split_by_timestamp_gap(data, gap_threshold=6, opacity=50)

    assert len(strokes) == 2
    assert strokes[0].opacity == 50
    assert strokes[1].opacity == 50