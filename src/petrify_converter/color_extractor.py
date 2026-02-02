# src/petrify_converter/color_extractor.py
import io

from PIL import Image


class ColorExtractor:
    """mainBmp 이미지에서 색상 추출."""

    BACKGROUND_COLORS = {"#ffffff", "#fffff0"}

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

    def extract_stroke_width(self, points: list[list]) -> int:
        """스트로크 포인트들의 대표 굵기 추출 (Q1 사용).

        - min: 너무 가는 이상치에 좌우됨
        - median: 교차점의 큰 값들에 영향받음
        - Q1 (하위 25%): 교차점 무시하면서 이상치에도 강건함

        Args:
            points: [[x, y, timestamp], ...] 형식

        Returns:
            굵기 (px). 측정 불가시 기본값 1.
        """
        widths = []
        for point in points:
            x, y = int(point[0]), int(point[1])
            w = self.get_width_at(x, y)
            if w > 0:
                widths.append(w)

        if not widths:
            return 1

        sorted_widths = sorted(widths)
        q1_idx = len(sorted_widths) // 4
        return sorted_widths[q1_idx]
