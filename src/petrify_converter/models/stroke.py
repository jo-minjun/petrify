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

    @classmethod
    def split_by_timestamp_gap(
        cls,
        data: list[list],
        gap_threshold: int = 6,
        color: str = "#000000",
        width: float = 1.0,
    ) -> list["Stroke"]:
        """timestamp gap 기준으로 스트로크 분리.

        Args:
            data: [[x, y, timestamp], ...] 형식의 점 데이터
            gap_threshold: 스트로크 분리 기준 gap (이상)
            color: 스트로크 색상
            width: 스트로크 굵기

        Returns:
            분리된 Stroke 리스트
        """
        if not data:
            return []

        sorted_data = sorted(data, key=lambda p: p[2])

        strokes = []
        current_points = [Point.from_list(sorted_data[0])]

        for i in range(1, len(sorted_data)):
            prev_ts = sorted_data[i - 1][2]
            curr_ts = sorted_data[i][2]
            gap = curr_ts - prev_ts

            if gap >= gap_threshold:
                strokes.append(cls(points=current_points, color=color, width=width))
                current_points = []

            current_points.append(Point.from_list(sorted_data[i]))

        if current_points:
            strokes.append(cls(points=current_points, color=color, width=width))

        return strokes
