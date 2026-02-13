import { parsePageMarkers } from '@petrify/core';

export function extractOcrByPageId(content: string): Map<string, string[]> {
  const separatorIndex = content.indexOf('\n---\n');
  if (separatorIndex === -1) return new Map();

  const ocrSection = content.slice(separatorIndex + 5);
  const lines = ocrSection.split('\n');
  return parsePageMarkers(lines);
}
