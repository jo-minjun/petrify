export interface PetrifyFrontmatter {
  readonly source: string | null;
  readonly mtime: number | null;
  readonly keep?: boolean;
}

export function createFrontmatter(meta: PetrifyFrontmatter): string {
  const keepLine = meta.keep ? '\n  keep: true' : '';
  return `---
petrify:
  source: ${meta.source}
  mtime: ${meta.mtime}${keepLine}
excalidraw-plugin: parsed
---

`;
}

export function parseFrontmatter(content: string): PetrifyFrontmatter | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const sourceMatch = frontmatter.match(/source:\s*(.+)/);
  const mtimeMatch = frontmatter.match(/mtime:\s*(.+)/);

  if (!sourceMatch || !mtimeMatch) {
    return null;
  }

  const sourceValue = sourceMatch[1].trim();
  const mtimeValue = mtimeMatch[1].trim();
  const keepMatch = frontmatter.match(/keep:\s*(true|false)/);

  return {
    source: sourceValue === 'null' ? null : sourceValue,
    mtime: mtimeValue === 'null' ? null : parseInt(mtimeValue, 10),
    ...(keepMatch && { keep: keepMatch[1] === 'true' }),
  };
}
