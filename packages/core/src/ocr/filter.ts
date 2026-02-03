import type { OcrRegion } from '../ports/ocr.js';

export function filterOcrByConfidence(
  regions: OcrRegion[],
  threshold: number
): string[] {
  return regions
    .filter(r => (r.confidence ?? 100) >= threshold)
    .map(r => r.text);
}
