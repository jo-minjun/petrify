// packages/core/tests/models/stroke.test.ts
import { describe, it, expect } from 'vitest';
import { Point, Stroke, pointFromList, strokeFromPathData, splitByTimestampGap } from '../../src/models/stroke';

describe('Point', () => {
  it('Point 생성', () => {
    const point: Point = { x: 100, y: 200, timestamp: 1234567890 };
    expect(point.x).toBe(100);
    expect(point.y).toBe(200);
    expect(point.timestamp).toBe(1234567890);
  });

  it('pointFromList로 생성', () => {
    const point = pointFromList([100, 200, 1234567890]);
    expect(point.x).toBe(100);
    expect(point.y).toBe(200);
    expect(point.timestamp).toBe(1234567890);
  });
});

describe('Stroke', () => {
  it('Stroke 생성', () => {
    const points: Point[] = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 10, y: 10, timestamp: 1 },
    ];
    const stroke: Stroke = { points, color: '#000000', width: 1, opacity: 100 };
    expect(stroke.points).toHaveLength(2);
    expect(stroke.color).toBe('#000000');
  });

  it('커스텀 스타일', () => {
    const stroke: Stroke = {
      points: [{ x: 0, y: 0, timestamp: 0 }],
      color: '#ff0000',
      width: 2.5,
      opacity: 50,
    };
    expect(stroke.color).toBe('#ff0000');
    expect(stroke.width).toBe(2.5);
    expect(stroke.opacity).toBe(50);
  });
});

describe('strokeFromPathData', () => {
  it('path 데이터에서 Stroke 생성', () => {
    const pathData = [[0, 0, 100], [10, 5, 101], [20, 10, 102]];
    const stroke = strokeFromPathData(pathData);
    expect(stroke.points).toHaveLength(3);
    expect(stroke.points[0].x).toBe(0);
    expect(stroke.points[2].y).toBe(10);
  });
});

describe('splitByTimestampGap', () => {
  it('gap >= 6 기준으로 스트로크 분리', () => {
    const data = [
      [100, 100, 1], [101, 101, 2], [102, 102, 3], [103, 103, 4], [104, 104, 5],
      // gap = 6 (11 - 5 = 6)
      [200, 200, 11], [201, 201, 12], [202, 202, 13],
    ];
    const strokes = splitByTimestampGap(data, 6);
    expect(strokes).toHaveLength(2);
    expect(strokes[0].points).toHaveLength(5);
    expect(strokes[1].points).toHaveLength(3);
  });

  it('timestamp 순서로 정렬 후 분리', () => {
    const data = [[200, 200, 11], [100, 100, 1], [101, 101, 2]];
    const strokes = splitByTimestampGap(data, 6);
    expect(strokes).toHaveLength(2);
    expect(strokes[0].points[0].timestamp).toBe(1);
  });

  it('빈 데이터는 빈 배열 반환', () => {
    const strokes = splitByTimestampGap([], 6);
    expect(strokes).toHaveLength(0);
  });
});
