import { parsePageMarkers } from '@petrify/core';

export function extractOcrByPageId(content: string): Map<string, string[]> {
  const lines = content.split(/\r?\n/);
  const ocrStart = lines.indexOf('## OCR Text');
  if (ocrStart === -1) return new Map();

  // Generated drawing data follows all OCR, which can itself contain the same heading.
  const ocrEnd = lines.lastIndexOf('# Excalidraw Data');
  return parsePageMarkers(lines.slice(ocrStart + 1, ocrEnd > ocrStart ? ocrEnd : undefined));
}
