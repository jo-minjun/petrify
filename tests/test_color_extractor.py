# tests/test_color_extractor.py
from PIL import Image
import io

from petrify_converter.color_extractor import ColorExtractor


def _create_test_image(color: tuple[int, int, int, int] = (255, 0, 0, 255)) -> bytes:
    """테스트용 이미지 생성 헬퍼."""
    img = Image.new('RGBA', (10, 10), color)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    return img_bytes.getvalue()


def test_extract_color_at_point():
    """포인트 좌표에서 색상 추출."""
    extractor = ColorExtractor(_create_test_image((255, 0, 0, 255)))
    color, alpha = extractor.get_color_at(5, 5)

    assert color == "#ff0000"
    assert alpha == 255


def test_extract_color_transparent():
    """투명도 있는 색상 추출."""
    extractor = ColorExtractor(_create_test_image((0, 180, 250, 100)))
    color, alpha = extractor.get_color_at(5, 5)

    assert color == "#00b4fa"
    assert alpha == 100


def test_classify_pen_type_black():
    """검정 볼펜 분류."""
    extractor = ColorExtractor(_create_test_image((0, 0, 0, 255)))
    pen_type = extractor.classify_pen_type("#000000", 255)

    assert pen_type == "pen"


def test_classify_pen_type_highlighter():
    """형광펜 분류 (낮은 알파값)."""
    extractor = ColorExtractor(_create_test_image((255, 0, 188, 76)))
    pen_type = extractor.classify_pen_type("#ff00bc", 76)

    assert pen_type == "highlighter"


def test_get_color_at_out_of_bounds():
    """범위 밖 좌표에서 기본값 반환."""
    extractor = ColorExtractor(_create_test_image())

    color, alpha = extractor.get_color_at(-1, 5)
    assert color == "#000000"
    assert alpha == 255

    color, alpha = extractor.get_color_at(5, -1)
    assert color == "#000000"
    assert alpha == 255

    color, alpha = extractor.get_color_at(100, 5)
    assert color == "#000000"
    assert alpha == 255

    color, alpha = extractor.get_color_at(5, 100)
    assert color == "#000000"
    assert alpha == 255


def test_classify_pen_type_at_alpha_threshold():
    """알파값이 정확히 ALPHA_THRESHOLD(200)일 때 pen으로 분류."""
    extractor = ColorExtractor(_create_test_image((0, 0, 0, 200)))
    pen_type = extractor.classify_pen_type("#000000", 200)

    assert pen_type == "pen"


def test_classify_pen_type_below_alpha_threshold():
    """알파값이 ALPHA_THRESHOLD(200) 미만일 때 highlighter로 분류."""
    extractor = ColorExtractor(_create_test_image((0, 0, 0, 199)))
    pen_type = extractor.classify_pen_type("#000000", 199)

    assert pen_type == "highlighter"


def test_extract_stroke_color():
    """스트로크의 대표 색상 추출."""
    img = Image.new('RGBA', (20, 10), (255, 0, 0, 255))
    for x in range(10, 20):
        for y in range(10):
            img.putpixel((x, y), (0, 0, 255, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    red_points = [[5, 5, 1], [6, 5, 2], [7, 5, 3]]
    color, alpha = extractor.extract_stroke_color(red_points)

    assert color == "#ff0000"
    assert alpha == 255


def test_get_width_at_basic():
    """포인트에서 스트로크 굵기 측정."""
    # 10x10 이미지, 중앙에 5px 굵기의 수직선
    img = Image.new('RGBA', (10, 10), (0, 0, 0, 0))  # 투명 배경
    for y in range(10):
        for x in range(3, 8):  # 5px 굵기
            img.putpixel((x, y), (0, 0, 0, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    width = extractor.get_width_at(5, 5)

    assert width == 5


def test_get_width_at_transparent():
    """투명 픽셀에서는 0 반환."""
    img = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    width = extractor.get_width_at(5, 5)

    assert width == 0


def test_get_width_at_out_of_bounds():
    """범위 벗어나면 0 반환."""
    img = Image.new('RGBA', (10, 10), (255, 0, 0, 255))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    assert extractor.get_width_at(-1, 5) == 0
    assert extractor.get_width_at(5, 100) == 0


def test_extract_stroke_width_median():
    """스트로크 포인트들의 중앙값 굵기 반환."""
    # 10x20 이미지, 위쪽은 3px, 아래쪽은 7px 굵기
    img = Image.new('RGBA', (20, 20), (0, 0, 0, 0))

    # 위쪽 3px 굵기 (y=0~9)
    for y in range(10):
        for x in range(4, 7):
            img.putpixel((x, y), (0, 0, 0, 255))

    # 아래쪽 7px 굵기 (y=10~19)
    for y in range(10, 20):
        for x in range(2, 9):
            img.putpixel((x, y), (0, 0, 0, 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    # 위쪽 3개, 아래쪽 2개 포인트 -> 중앙값은 3
    points = [
        [5, 2, 1], [5, 5, 2], [5, 8, 3],  # 위쪽 (굵기 3)
        [5, 12, 4], [5, 15, 5],            # 아래쪽 (굵기 7)
    ]
    width = extractor.extract_stroke_width(points)

    assert width == 3  # 중앙값


def test_extract_stroke_width_empty():
    """포인트가 없거나 모두 투명이면 기본값 1 반환."""
    img = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())

    assert extractor.extract_stroke_width([]) == 1
    assert extractor.extract_stroke_width([[5, 5, 1]]) == 1  # 투명
