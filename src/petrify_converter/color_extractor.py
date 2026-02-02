# src/petrify_converter/color_extractor.py
from collections import Counter
from PIL import Image
import io


class ColorExtractor:
    """mainBmp 이미지에서 색상 추출."""

    ALPHA_THRESHOLD = 200  # 이 값 미만이면 형광펜으로 분류
    BACKGROUND_COLORS = ("#ffffff", "#fefefe", "#fdfdfd")

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

    def extract_stroke_color(self, points: list[list]) -> tuple[str, int]:
        """스트로크 포인트들의 대표 색상 추출.

        가장 많이 나타나는 색상을 반환 (배경색 제외).

        Args:
            points: [[x, y, timestamp], ...] 형식

        Returns:
            (hex_color, alpha) 튜플
        """
        colors = []
        for point in points:
            x, y = int(point[0]), int(point[1])
            color, alpha = self.get_color_at(x, y)

            if color.lower() not in self.BACKGROUND_COLORS:
                colors.append((color, alpha))

        if not colors:
            return "#000000", 255

        color_counts = Counter(colors)
        most_common = color_counts.most_common(1)[0][0]
        return most_common

    def get_width_at(self, x: int, y: int) -> int:
        """포인트에서 스트로크 굵기 측정 (4방향, alpha > 0 기준).

        Returns:
            굵기 (px). 투명이거나 범위 벗어나면 0.
        """
        if not (0 <= x < self.width and 0 <= y < self.height):
            return 0

        if self.pixels[x, y][3] == 0:  # 투명
            return 0

        # 수직 측정
        v_width = 1
        for dy in [-1, 1]:
            cy = y + dy
            while 0 <= cy < self.height and self.pixels[x, cy][3] > 0:
                v_width += 1
                cy += dy

        # 수평 측정
        h_width = 1
        for dx in [-1, 1]:
            cx = x + dx
            while 0 <= cx < self.width and self.pixels[cx, y][3] > 0:
                h_width += 1
                cx += dx

        return min(v_width, h_width)
