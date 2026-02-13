import { describe, expect, it } from 'vitest';
import {
  createFrontmatter,
  parseFrontmatter,
  updateKeepInContent,
} from '../../src/utils/frontmatter.js';

describe('frontmatter', () => {
  describe('createFrontmatter', () => {
    it('generates frontmatter with page hashes', () => {
      const result = createFrontmatter({
        source: '/path/to/file.note',
        parser: 'viwoods',
        fileHash: 'abc123',
        pageHashes: [
          { id: 'page-1', hash: 'aaa' },
          { id: 'page-2', hash: 'bbb' },
        ],
        keep: false,
      });

      expect(result).toContain('petrify:');
      expect(result).toContain('source: /path/to/file.note');
      expect(result).toContain('parser: viwoods');
      expect(result).toContain('fileHash: abc123');
      expect(result).toContain('keep: false');
      expect(result).toContain('page-1: aaa');
      expect(result).toContain('page-2: bbb');
      expect(result).toContain('excalidraw-plugin: parsed');
      expect(result).not.toContain('mtime');
    });

    it('generates frontmatter with null values', () => {
      const result = createFrontmatter({
        source: null,
        parser: null,
        fileHash: null,
        pageHashes: null,
        keep: true,
      });

      expect(result).toContain('source: null');
      expect(result).toContain('parser: null');
      expect(result).toContain('fileHash: null');
      expect(result).toContain('keep: true');
      expect(result).not.toContain('pageHashes');
    });

    it('outputs keep: false when keep is not provided', () => {
      const result = createFrontmatter({
        source: '/path/to/file',
        parser: 'viwoods',
        fileHash: 'hash123',
        pageHashes: null,
      });

      expect(result).toContain('keep: false');
    });

    it('omits pageHashes section when array is empty', () => {
      const result = createFrontmatter({
        source: '/path/to/file',
        parser: 'viwoods',
        fileHash: 'hash123',
        pageHashes: [],
      });

      expect(result).not.toContain('pageHashes');
    });
  });

  describe('parseFrontmatter', () => {
    it('parses page hashes from frontmatter', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: false
  pageHashes:
    page-1: aaa
    page-2: bbb
excalidraw-plugin: parsed
---

content`;

      const result = parseFrontmatter(content);

      expect(result?.source).toBe('/path/to/file.note');
      expect(result?.parser).toBe('viwoods');
      expect(result?.fileHash).toBe('abc123');
      expect(result?.pageHashes).toEqual([
        { id: 'page-1', hash: 'aaa' },
        { id: 'page-2', hash: 'bbb' },
      ]);
      expect(result?.keep).toBe(false);
    });

    it('returns null when source is missing', () => {
      const content = `---
excalidraw-plugin: parsed
---

content`;

      expect(parseFrontmatter(content)).toBeNull();
    });

    it('parses null values', () => {
      const content = `---
petrify:
  source: null
  parser: null
  fileHash: null
  keep: true
excalidraw-plugin: parsed
---

content`;

      const result = parseFrontmatter(content);

      expect(result?.source).toBeNull();
      expect(result?.parser).toBeNull();
      expect(result?.fileHash).toBeNull();
      expect(result?.pageHashes).toBeNull();
      expect(result?.keep).toBe(true);
    });

    it('keep is undefined when the keep field is absent', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result?.keep).toBeUndefined();
    });

    it('parses frontmatter without parser and fileHash', () => {
      const content = `---
petrify:
  source: /path/to/file.note
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result?.source).toBe('/path/to/file.note');
      expect(result?.parser).toBeNull();
      expect(result?.fileHash).toBeNull();
      expect(result?.pageHashes).toBeNull();
    });
  });

  describe('updateKeepInContent', () => {
    it('adds keep: true to frontmatter', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: false
  pageHashes:
    page-1: aaa
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, true);

      expect(result).toContain('keep: true');
      expect(result).toContain('# Content');
      expect(result).toContain('source: /path/to/file.note');
      expect(result).toContain('parser: viwoods');
      expect(result).toContain('fileHash: abc123');
    });

    it('changes keep: true to keep: false', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: true
  pageHashes:
    page-1: aaa
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, false);

      expect(result).toContain('keep: false');
      expect(result).not.toContain('keep: true');
      expect(result).toContain('# Content');
      expect(result).toContain('source: /path/to/file.note');
    });

    it('changes keep: false to keep: true', () => {
      const content = `---
petrify:
  source: null
  parser: null
  fileHash: null
  keep: false
excalidraw-plugin: parsed
---

content`;

      const result = updateKeepInContent(content, true);

      expect(result).toContain('keep: true');
      expect(result).not.toContain('keep: false');
    });

    it('no change when setting true on already keep: true', () => {
      const content = `---
petrify:
  source: null
  parser: null
  fileHash: null
  keep: true
excalidraw-plugin: parsed
---

content`;

      const result = updateKeepInContent(content, true);

      expect(result).toBe(content);
    });

    it('returns a file without frontmatter unchanged', () => {
      const content = '# Just a markdown file';

      const result = updateKeepInContent(content, true);

      expect(result).toBe(content);
    });

    it('replaces correctly even with only one newline after frontmatter', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: false
excalidraw-plugin: parsed
---
# Content`;

      const result = updateKeepInContent(content, true);

      expect(result).toContain('keep: true');
      expect(result).toContain('# Content');
    });

    it('returns frontmatter without petrify metadata unchanged', () => {
      const content = `---
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, true);

      expect(result).toBe(content);
    });

    it('preserves page hashes when updating keep', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  parser: viwoods
  fileHash: abc123
  keep: false
  pageHashes:
    page-1: aaa
    page-2: bbb
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, true);

      expect(result).toContain('keep: true');
      expect(result).toContain('page-1: aaa');
      expect(result).toContain('page-2: bbb');
    });
  });
});
