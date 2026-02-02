from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float
    timestamp: int

    @classmethod
    def from_list(cls, data: list) -> "Point":
        return cls(x=float(data[0]), y=float(data[1]), timestamp=int(data[2]))
