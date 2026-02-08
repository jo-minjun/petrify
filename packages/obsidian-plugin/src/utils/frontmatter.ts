export interface PetrifyFrontmatter {
  readonly source: string | null;
  readonly mtime: number | null;
  readonly keep?: boolean;
}

export function createFrontmatter(meta: PetrifyFrontmatter): string {
  const keep = meta.keep ?? false;
  return `---
petrify:
  source: ${meta.source}
  mtime: ${meta.mtime}
  keep: ${keep}
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

export function updateKeepInContent(content: string, keep: boolean): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return content;

  const meta = parseFrontmatter(content);
  if (!meta) return content;

  const newFrontmatter = createFrontmatter({ ...meta, keep });
  return content.replace(/^---\n[\s\S]*?\n---\n\n/, newFrontmatter);
}
