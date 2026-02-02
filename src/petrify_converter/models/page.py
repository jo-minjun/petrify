from dataclasses import dataclass

from petrify_converter.models.stroke import Stroke


@dataclass
class Page:
    id: str
    strokes: list[Stroke]
    width: float = 1440.0
    height: float = 1920.0
