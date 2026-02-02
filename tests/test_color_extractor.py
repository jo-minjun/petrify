# tests/test_color_extractor.py
from pathlib import Path
from PIL import Image
import io

from petrify_converter.color_extractor import ColorExtractor


def test_extract_color_at_point():
    """포인트 좌표에서 색상 추출."""
    # 10x10 빨간색 이미지 생성
    img = Image.new('RGBA', (10, 10), (255, 0, 0, 255))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    color, alpha = extractor.get_color_at(5, 5)

    assert color == "#ff0000"
    assert alpha == 255


def test_extract_color_transparent():
    """투명도 있는 색상 추출."""
    img = Image.new('RGBA', (10, 10), (0, 180, 250, 100))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')

    extractor = ColorExtractor(img_bytes.getvalue())
    color, alpha = extractor.get_color_at(5, 5)

    assert color == "#00b4fa"
    assert alpha == 100


def test_classify_pen_type_black():
    """검정 볼펜 분류."""
    extractor = ColorExtractor.__new__(ColorExtractor)
    pen_type = extractor.classify_pen_type("#000000", 255)

    assert pen_type == "pen"


def test_classify_pen_type_highlighter():
    """형광펜 분류 (낮은 알파값)."""
    extractor = ColorExtractor.__new__(ColorExtractor)
    pen_type = extractor.classify_pen_type("#ff00bc", 76)

    assert pen_type == "highlighter"
