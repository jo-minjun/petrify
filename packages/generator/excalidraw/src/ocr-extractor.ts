import { parsePageMarkers } from '@petrify/core';

export function extractOcrByPageId(content: string): Map<string, string[]> {
  const ocrStart = content.indexOf('## OCR Text');
  if (ocrStart === -1) return new Map();

  const ocrEnd = content.indexOf('\n# ', ocrStart);
  const ocrSection = ocrEnd === -1 ? content.slice(ocrStart) : content.slice(ocrStart, ocrEnd);

  const lines = ocrSection.split('\n');
  // Skip the "## OCR Text" header line
  const contentLines = lines.filter((line) => line !== '## OCR Text');
  return parsePageMarkers(contentLines);
}
