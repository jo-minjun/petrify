export interface PetrifyFrontmatter {
  source: string;
  mtime: number;
}

export function createFrontmatter(meta: PetrifyFrontmatter): string {
  return `---
petrify:
  source: ${meta.source}
  mtime: ${meta.mtime}
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
  const mtimeMatch = frontmatter.match(/mtime:\s*(\d+)/);

  if (!sourceMatch || !mtimeMatch) {
    return null;
  }

  return {
    source: sourceMatch[1].trim(),
    mtime: parseInt(mtimeMatch[1], 10),
  };
}
