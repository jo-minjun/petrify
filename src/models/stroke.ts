// src/models/stroke.ts
export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

export function pointFromList(data: number[]): Point {
  return {
    x: data[0],
    y: data[1],
    timestamp: data[2],
  };
}

export function strokeFromPathData(
  data: number[][],
  color = '#000000',
  width = 1,
  opacity = 100
): Stroke {
  const points = data.map(pointFromList);
  return { points, color, width, opacity };
}

export function splitByTimestampGap(
  data: number[][],
  gapThreshold: number,
  color = '#000000',
  width = 1,
  opacity = 100
): Stroke[] {
  if (data.length === 0) {
    return [];
  }

  const sortedData = [...data].sort((a, b) => a[2] - b[2]);
  const strokes: Stroke[] = [];
  let currentPoints: Point[] = [pointFromList(sortedData[0])];

  for (let i = 1; i < sortedData.length; i++) {
    const prevTs = sortedData[i - 1][2];
    const currTs = sortedData[i][2];
    const gap = currTs - prevTs;

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
