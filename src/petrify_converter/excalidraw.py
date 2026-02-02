import base64
import random
import uuid
from typing import Any

from petrify_converter.models import Note, Page, Stroke


class ExcalidrawGenerator:
    PAGE_GAP = 100

    def __init__(self, include_background: bool = True):
        self.include_background = include_background

    def generate(self, note: Note) -> dict[str, Any]:
        """Note를 Excalidraw 문서로 변환."""
        elements = []
        files: dict[str, Any] = {}
        y_offset = 0

        for page in note.pages:
            page_elements, page_files = self._generate_page_elements(page, y_offset)
            elements.extend(page_elements)
            files.update(page_files)
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
            "files": files,
        }

    def _generate_page_elements(
        self, page: Page, y_offset: float
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """페이지의 모든 요소 생성."""
        elements = []
        files: dict[str, Any] = {}

        if self.include_background and page.background_image is not None:
            image_element, file_data = self.create_image(
                page.background_image,
                page.width,
                page.height,
                x_offset=0,
                y_offset=y_offset,
            )
            elements.append(image_element)
            files.update(file_data)

        for stroke in page.strokes:
            element = self.create_freedraw(stroke, x_offset=0, y_offset=y_offset)
            elements.append(element)

        return elements, files

    def create_image(
        self,
        image_data: bytes,
        width: float,
        height: float,
        x_offset: float,
        y_offset: float,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """이미지 요소 생성."""
        file_id = self._generate_id()
        data_url = f"data:image/png;base64,{base64.b64encode(image_data).decode()}"

        element = {
            "type": "image",
            "id": self._generate_id(),
            "x": x_offset,
            "y": y_offset,
            "width": width,
            "height": height,
            "strokeColor": "transparent",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "angle": 0,
            "seed": self._generate_seed(),
            "version": 1,
            "versionNonce": self._generate_seed(),
            "index": "a0",
            "isDeleted": False,
            "groupIds": [],
            "frameId": None,
            "roundness": None,
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False,
            "fileId": file_id,
            "status": "saved",
            "scale": [1, 1],
            "crop": None,
        }

        file_data = {
            file_id: {
                "mimeType": "image/png",
                "id": file_id,
                "dataURL": data_url,
                "created": 1,
            }
        }

        return element, file_data

    def create_freedraw(
        self, stroke: Stroke, x_offset: float, y_offset: float
    ) -> dict[str, Any]:
        """Stroke를 freedraw 요소로 변환."""
        if not stroke.points:
            return self._empty_freedraw(x_offset, y_offset, stroke)

        first_point = stroke.points[0]
        points = [[p.x - first_point.x, p.y - first_point.y] for p in stroke.points]

        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        width = max(xs) - min(xs) if xs else 0
        height = max(ys) - min(ys) if ys else 0

        return {
            "type": "freedraw",
            "id": self._generate_id(),
            "x": first_point.x + x_offset,
            "y": first_point.y + y_offset,
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

    def _empty_freedraw(
        self, x_offset: float, y_offset: float, stroke: Stroke
    ) -> dict[str, Any]:
        """빈 freedraw 요소 생성."""
        return {
            "type": "freedraw",
            "id": self._generate_id(),
            "x": x_offset,
            "y": y_offset,
            "width": 0,
            "height": 0,
            "strokeColor": stroke.color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": int(stroke.width),
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": stroke.opacity,
            "angle": 0,
            "points": [],
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

    @staticmethod
    def _generate_id() -> str:
        """고유 ID 생성 (40자리 16진수, Obsidian Excalidraw 플러그인 호환)."""
        return uuid.uuid4().hex + uuid.uuid4().hex[:8]

    @staticmethod
    def _generate_seed() -> int:
        """랜덤 seed 생성."""
        return random.randint(1, 2147483647)
