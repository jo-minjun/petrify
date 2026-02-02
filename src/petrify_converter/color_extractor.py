# src/petrify_converter/color_extractor.py
import io

from PIL import Image


class ColorExtractor:
    """mainBmp 이미지에서 색상 추출."""

    BACKGROUND_COLORS = {"#ffffff", "#fffff0"}
    OUTLIER_THRESHOLD = 1.5
    LOWER_PERCENTILE = 5

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
        """스트로크 포인트들의 대표 굵기 추출 (outlier 필터링 + 하위 20%).

        - 정렬된 배열에서 급격한 변화(1.5배 이상)가 시작되는 지점 이전까지만 사용
        - 교차점에서 과대측정된 값을 효과적으로 제거

        Args:
            points: [[x, y, timestamp], ...] 형식

        Returns:
            굵기 (px). 측정 불가시 기본값 1.
        """
        widths = [
            w for point in points
            if (w := self.get_width_at(int(point[0]), int(point[1]))) > 0
        ]

        if not widths:
            return 1

        filtered = self._filter_outliers(sorted(widths))
        idx = len(filtered) // self.LOWER_PERCENTILE
        return filtered[idx]

    def _filter_outliers(self, sorted_widths: list[int]) -> list[int]:
        """급격한 변화가 시작되는 지점 이전까지 필터링."""
        if len(sorted_widths) <= 1:
            return sorted_widths

        filtered = [sorted_widths[0]]
        for i in range(1, len(sorted_widths)):
            if sorted_widths[i] > sorted_widths[i - 1] * self.OUTLIER_THRESHOLD:
                break
            filtered.append(sorted_widths[i])

        return filtered
