import random
import uuid
from typing import Any

from petrify_converter.models import Note, Page, Stroke


class ExcalidrawGenerator:
    PAGE_GAP = 100
    STROKE_WIDTH_DIVISOR = 4
    MIN_STROKE_WIDTH = 1

    def generate(self, note: Note) -> dict[str, Any]:
        """Note를 Excalidraw 문서로 변환."""
        elements = []
        y_offset = 0

        for page in note.pages:
            page_elements = self._generate_page_elements(page, y_offset)
            elements.extend(page_elements)
            y_offset += page.height + self.PAGE_GAP

        return {
            "type": "excalidraw",
            "version": 2,
            "source": "petrify-converter",
            "elements": elements,
            "appState": {
                "gridSize": None,
                "viewBackgroundColor": "#ffffff",
            },
            "files": {},
        }

    def _generate_page_elements(
        self, page: Page, y_offset: float
    ) -> list[dict[str, Any]]:
        """페이지의 모든 요소 생성."""
        return [
            self.create_freedraw(stroke, x_offset=0, y_offset=y_offset)
            for stroke in page.strokes
        ]

    def create_freedraw(
        self, stroke: Stroke, x_offset: float, y_offset: float
    ) -> dict[str, Any]:
        """Stroke를 freedraw 요소로 변환."""
        if not stroke.points:
            return self._create_freedraw_element(
                x=x_offset, y=y_offset, points=[], width=0, height=0, stroke=stroke
            )

        first_point = stroke.points[0]
        x, y = first_point.x + x_offset, first_point.y + y_offset
        points = [[p.x - first_point.x, p.y - first_point.y] for p in stroke.points]
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        width = max(xs) - min(xs)
        height = max(ys) - min(ys)

        return self._create_freedraw_element(
            x=x, y=y, points=points, width=width, height=height, stroke=stroke
        )

    def _create_freedraw_element(
        self,
        x: float,
        y: float,
        points: list[list[float]],
        width: float,
        height: float,
        stroke: Stroke,
    ) -> dict[str, Any]:
        """freedraw 요소 딕셔너리 생성."""
        return {
            "type": "freedraw",
            "id": self._generate_id(),
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "strokeColor": stroke.color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": int(stroke.width),
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": stroke.opacity,
            "angle": 0,
            "points": points,
            "pressures": [],
            "simulatePressure": True,
            "seed": self._generate_seed(),
            "version": 1,
            "versionNonce": self._generate_seed(),
            "isDeleted": False,
            "groupIds": [],
            "frameId": None,
            "boundElements": None,
            "updated": 1,
            "link": None,
            "locked": False,
        }

    def _scale_stroke_width(self, width: float) -> int:
        """mainBmp 픽셀 굵기를 Excalidraw strokeWidth로 스케일링."""
        scaled = int(width / self.STROKE_WIDTH_DIVISOR)
        return max(self.MIN_STROKE_WIDTH, scaled)

    @staticmethod
    def _generate_id() -> str:
        """고유 ID 생성 (40자리 16진수, Obsidian Excalidraw 플러그인 호환)."""
        return uuid.uuid4().hex + uuid.uuid4().hex[:8]

    @staticmethod
    def _generate_seed() -> int:
        """랜덤 seed 생성."""
        return random.randint(1, 2147483647)
