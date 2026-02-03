// tests/excalidraw.test.ts
import { describe, it, expect } from 'vitest';
import { ExcalidrawGenerator } from '../src/excalidraw';
import type { Note } from '../src/models/note';
import type { Page } from '../src/models/page';
import type { Point, Stroke } from '../src/models/stroke';

describe('ExcalidrawGenerator', () => {
  describe('createFreedraw', () => {
    it('freedraw 요소 생성', () => {
      const points: Point[] = [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 5, timestamp: 1 },
        { x: 20, y: 10, timestamp: 2 },
      ];
      const stroke: Stroke = { points, color: '#000000', width: 1, opacity: 100 };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.type).toBe('freedraw');
      expect(element.strokeColor).toBe('#000000');
      expect(element.strokeWidth).toBe(1);
      expect(element.points).toHaveLength(3);
    });

    it('필수 필드 포함', () => {
      const stroke: Stroke = {
        points: [{ x: 0, y: 0, timestamp: 0 }],
        color: '#ff0000',
        width: 2,
        opacity: 100,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      const requiredFields = [
        'type', 'id', 'x', 'y', 'width', 'height',
        'strokeColor', 'strokeWidth', 'points', 'opacity', 'roughness', 'seed',
      ];
      for (const field of requiredFields) {
        expect(element).toHaveProperty(field);
      }
    });

    it('투명도 적용', () => {
      const stroke: Stroke = {
        points: [{ x: 0, y: 0, timestamp: 1 }, { x: 10, y: 10, timestamp: 2 }],
        color: '#ff00bc',
        width: 1,
        opacity: 50,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.strokeColor).toBe('#ff00bc');
      expect(element.opacity).toBe(50);
    });

    it('simulatePressure가 false', () => {
      const stroke: Stroke = {
        points: [{ x: 0, y: 0, timestamp: 0 }, { x: 10, y: 10, timestamp: 1 }],
        color: '#000000',
        width: 8,
        opacity: 100,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.simulatePressure).toBe(false);
    });

    it('pressures가 0.5로 채워짐', () => {
      const stroke: Stroke = {
        points: [
          { x: 0, y: 0, timestamp: 0 },
          { x: 10, y: 10, timestamp: 1 },
          { x: 20, y: 20, timestamp: 2 },
        ],
        color: '#000000',
        width: 8,
        opacity: 100,
      };
      const generator = new ExcalidrawGenerator();
      const element = generator.createFreedraw(stroke, 0, 0);

      expect(element.pressures).toEqual([0.5, 0.5, 0.5]);
    });
  });

  describe('scaleStrokeWidth', () => {
    it('일반 스케일링', () => {
      const generator = new ExcalidrawGenerator();
      expect(generator['scaleStrokeWidth'](6)).toBe(1);
      expect(generator['scaleStrokeWidth'](12)).toBe(2);
      expect(generator['scaleStrokeWidth'](18)).toBe(3);
      expect(generator['scaleStrokeWidth'](74)).toBe(12);
    });

    it('최소값 1 보장', () => {
      const generator = new ExcalidrawGenerator();
      expect(generator['scaleStrokeWidth'](1)).toBe(1);
      expect(generator['scaleStrokeWidth'](0)).toBe(1);
    });
  });

  describe('generate', () => {
    it('전체 문서 생성', () => {
      const page: Page = {
        id: 'page-1',
        strokes: [{
          points: [{ x: 0, y: 0, timestamp: 0 }, { x: 10, y: 10, timestamp: 1 }],
          color: '#000000',
          width: 1,
          opacity: 100,
        }],
        width: 1440,
        height: 1920,
      };
      const note: Note = {
        title: 'Test',
        pages: [page],
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.type).toBe('excalidraw');
      expect(doc.version).toBe(2);
      expect(doc.elements).toBeDefined();
      expect(doc.appState).toBeDefined();
    });
  });
});
