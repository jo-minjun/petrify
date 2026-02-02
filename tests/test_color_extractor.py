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
