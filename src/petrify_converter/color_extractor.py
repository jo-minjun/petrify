# src/petrify_converter/color_extractor.py
from PIL import Image
import io


class ColorExtractor:
    """mainBmp 이미지에서 색상 추출."""

    ALPHA_THRESHOLD = 200  # 이 값 미만이면 형광펜으로 분류

    def __init__(self, image_data: bytes):
        self.image = Image.open(io.BytesIO(image_data)).convert('RGBA')
        self.pixels = self.image.load()
        self.width, self.height = self.image.size

    def get_color_at(self, x: int, y: int) -> tuple[str, int]:
        """좌표에서 색상과 알파값 추출.

        Returns:
            (hex_color, alpha) 튜플
        """
        if not (0 <= x < self.width and 0 <= y < self.height):
            return "#000000", 255

        r, g, b, a = self.pixels[x, y]
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        return hex_color, a

    def classify_pen_type(self, color: str, alpha: int) -> str:
        """색상과 알파값으로 펜 타입 분류.

        Returns:
            "pen" 또는 "highlighter"
        """
        if alpha < self.ALPHA_THRESHOLD:
            return "highlighter"
        return "pen"
