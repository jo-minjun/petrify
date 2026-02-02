from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float
    timestamp: int

    @classmethod
    def from_list(cls, data: list) -> "Point":
        return cls(x=float(data[0]), y=float(data[1]), timestamp=int(data[2]))


@dataclass
class Stroke:
    points: list[Point]
    color: str = "#000000"
    width: float = 1.0

    @classmethod
    def from_path_data(
        cls, data: list[list], color: str = "#000000", width: float = 1.0
    ) -> "Stroke":
        points = [Point.from_list(p) for p in data]
        return cls(points=points, color=color, width=width)
