// src/models/page.ts
import type { Stroke } from './stroke';

export interface Page {
  id: string;
  strokes: Stroke[];
  width: number;
  height: number;
}

export const DEFAULT_PAGE_WIDTH = 1440;
export const DEFAULT_PAGE_HEIGHT = 1920;
