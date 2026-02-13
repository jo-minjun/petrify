const PAGE_MARKER_RE = /^<!-- page: (.+?) -->$/;

/**
 * Parses page-marker-delimited OCR text into a map of pageId -> text lines.
 * Expects input lines in the format:
 *   <!-- page: page-id -->
 *   text line 1
 *   text line 2
 */
export function parsePageMarkers(lines: readonly string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let currentPageId: string | null = null;
  let currentTexts: string[] = [];

  for (const line of lines) {
    const match = line.match(PAGE_MARKER_RE);
    if (match) {
      flushPage(result, currentPageId, currentTexts);
      currentPageId = match[1];
      currentTexts = [];
    } else if (currentPageId) {
      currentTexts.push(line);
    }
  }

  flushPage(result, currentPageId, currentTexts);
  return result;
}

function flushPage(result: Map<string, string[]>, pageId: string | null, texts: string[]): void {
  if (!pageId) return;
  const nonEmpty = texts.filter((t) => t.length > 0);
  if (nonEmpty.length > 0) {
    result.set(pageId, nonEmpty);
  }
}
