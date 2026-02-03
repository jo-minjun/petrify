// packages/core/src/models/stroke.ts
export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
}

export interface Stroke extends StrokeStyle {
  points: Point[];
}

const DEFAULT_STYLE: StrokeStyle = {
  color: '#000000',
  width: 1,
  opacity: 100,
};

export function pointFromList(data: number[]): Point {
  return {
    x: data[0],
    y: data[1],
    timestamp: data[2],
  };
}

export function strokeFromPathData(
  data: number[][],
  style: Partial<StrokeStyle> = {}
): Stroke {
  const { color, width, opacity } = { ...DEFAULT_STYLE, ...style };
  return { points: data.map(pointFromList), color, width, opacity };
}

export function splitByTimestampGap(
  data: number[][],
  gapThreshold: number,
  style: Partial<StrokeStyle> = {}
): Stroke[] {
  if (data.length === 0) {
    return [];
  }

  const { color, width, opacity } = { ...DEFAULT_STYLE, ...style };
  const sortedData = [...data].sort((a, b) => a[2] - b[2]);
  const strokes: Stroke[] = [];
  let currentPoints: Point[] = [pointFromList(sortedData[0])];

  for (let i = 1; i < sortedData.length; i++) {
    const gap = sortedData[i][2] - sortedData[i - 1][2];

    if (gap >= gapThreshold) {
      strokes.push({ points: currentPoints, color, width, opacity });
      currentPoints = [];
    }

    currentPoints.push(pointFromList(sortedData[i]));
  }

  if (currentPoints.length > 0) {
    strokes.push({ points: currentPoints, color, width, opacity });
  }

  return strokes;
}
