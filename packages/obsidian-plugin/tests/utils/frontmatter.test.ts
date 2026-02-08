import { describe, expect, it } from 'vitest';
import {
  createFrontmatter,
  parseFrontmatter,
  updateKeepInContent,
} from '../../src/utils/frontmatter.js';

describe('frontmatter', () => {
  describe('createFrontmatter', () => {
    it('generates a frontmatter string containing source and mtime', () => {
      const result = createFrontmatter({
        source: '/path/to/file.note',
        mtime: 1705315800000,
      });

      expect(result).toContain('petrify:');
      expect(result).toContain('source: /path/to/file.note');
      expect(result).toContain('mtime: 1705315800000');
      expect(result).toContain('excalidraw-plugin: parsed');
    });

    it('generates frontmatter with keep: true', () => {
      const result = createFrontmatter({ source: null, mtime: null, keep: true });

      expect(result).toContain('source: null');
      expect(result).toContain('mtime: null');
      expect(result).toContain('keep: true');
      expect(result).toContain('excalidraw-plugin: parsed');
    });

    it('outputs keep: false when keep is not provided', () => {
      const result = createFrontmatter({ source: '/path/to/file', mtime: 123 });

      expect(result).toContain('keep: false');
    });
  });

  describe('parseFrontmatter', () => {
    it('parses petrify metadata from frontmatter', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result).toEqual({
        source: '/path/to/file.note',
        mtime: 1705315800000,
      });
    });

    it('parses the keep: true flag', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
  keep: true
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result).toEqual({
        source: '/path/to/file.note',
        mtime: 1705315800000,
        keep: true,
      });
    });

    it('keep is undefined when the keep field is absent', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result?.keep).toBeUndefined();
    });

    it('returns null when petrify metadata is missing', () => {
      const content = `---
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result).toBeNull();
    });

    it('parses source: null and mtime: null', () => {
      const content = `---
petrify:
  source: null
  mtime: null
  keep: true
excalidraw-plugin: parsed
---

content`;

      const result = parseFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.source).toBeNull();
      expect(result?.mtime).toBeNull();
      expect(result?.keep).toBe(true);
    });
  });

  describe('updateKeepInContent', () => {
    it('adds keep: true to frontmatter that has no keep field', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, true);

      expect(result).toContain('keep: true');
      expect(result).toContain('# Content');
      expect(result).toContain('source: /path/to/file.note');
    });

    it('changes keep: true to keep: false', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
  keep: true
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
  mtime: null
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
  mtime: null
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
  mtime: 1705315800000
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
  });
});
