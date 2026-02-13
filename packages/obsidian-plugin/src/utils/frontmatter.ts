import type { PageHash } from '@petrify/core';

export interface PetrifyFrontmatter {
  readonly source: string | null;
  readonly parser: string | null;
  readonly fileHash: string | null;
  readonly pageHashes: readonly PageHash[] | null;
  readonly keep?: boolean;
}

export function createFrontmatter(meta: PetrifyFrontmatter): string {
  const keep = meta.keep ?? false;
  const pageHashesSection = formatPageHashes(meta.pageHashes);
  return `---
petrify:
  source: ${meta.source}
  parser: ${meta.parser}
  fileHash: ${meta.fileHash}
  keep: ${keep}${pageHashesSection}
excalidraw-plugin: parsed
---

`;
}

export function parseFrontmatter(content: string): PetrifyFrontmatter | null {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  if (!hasField(frontmatter, 'source')) return null;

  const source = extractField(frontmatter, /source:\s*(.+)/);
  const parser = extractField(frontmatter, /parser:\s*(.+)/);
  const fileHash = extractField(frontmatter, /fileHash:\s*(.+)/);
  const keepMatch = frontmatter.match(/keep:\s*(true|false)/);

  return {
    source,
    parser,
    fileHash,
    pageHashes: parsePageHashes(frontmatter),
    ...(keepMatch && { keep: keepMatch[1] === 'true' }),
  };
}

export function updateKeepInContent(content: string, keep: boolean): string {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return content;

  const meta = parseFrontmatter(content);
  if (!meta) return content;

  const newFrontmatter = createFrontmatter({ ...meta, keep });
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, newFrontmatter);
}

function formatPageHashes(pageHashes: readonly PageHash[] | null): string {
  if (!pageHashes || pageHashes.length === 0) return '';
  const entries = pageHashes.map((p) => `    ${p.id}: ${p.hash}`).join('\n');
  return `\n  pageHashes:\n${entries}`;
}

function hasField(frontmatter: string, fieldName: string): boolean {
  return new RegExp(`${fieldName}:\\s*`).test(frontmatter);
}

/** Extracts a YAML field value, converting the literal string "null" to actual null. */
function extractField(frontmatter: string, pattern: RegExp): string | null {
  const match = frontmatter.match(pattern);
  if (!match) return null;
  const value = match[1].trim();
  return value === 'null' ? null : value;
}

function parsePageHashes(frontmatter: string): PageHash[] | null {
  const pageHashesMatch = frontmatter.match(/pageHashes:\r?\n((?:\s{4}\S+:.*\r?\n?)*)/);
  if (!pageHashesMatch) return null;

  const entries = pageHashesMatch[1].trim().split(/\r?\n/);
  const result: PageHash[] = [];

  for (const entry of entries) {
    const match = entry.trim().match(/^(\S+):\s*(\S+)$/);
    if (match) {
      result.push({ id: match[1], hash: match[2] });
    }
  }

  return result.length > 0 ? result : null;
}
