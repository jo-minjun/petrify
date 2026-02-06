import { describe, expect, it } from 'vitest';
import { createFrontmatter, parseFrontmatter } from '../../src/utils/frontmatter.js';

describe('frontmatter', () => {
  describe('createFrontmatter', () => {
    it('source와 mtime을 포함한 frontmatter 문자열을 생성한다', () => {
      const result = createFrontmatter({
        source: '/path/to/file.note',
        mtime: 1705315800000,
      });

      expect(result).toContain('petrify:');
      expect(result).toContain('source: /path/to/file.note');
      expect(result).toContain('mtime: 1705315800000');
      expect(result).toContain('excalidraw-plugin: parsed');
    });

    it('keep: true 프론트매터를 생성한다', () => {
      const result = createFrontmatter({ source: null, mtime: null, keep: true });

      expect(result).toContain('source: null');
      expect(result).toContain('mtime: null');
      expect(result).toContain('keep: true');
      expect(result).toContain('excalidraw-plugin: parsed');
    });

    it('keep이 없으면 keep 필드를 생략한다', () => {
      const result = createFrontmatter({ source: '/path/to/file', mtime: 123 });

      expect(result).not.toContain('keep');
    });
  });

  describe('parseFrontmatter', () => {
    it('frontmatter에서 petrify 메타데이터를 파싱한다', () => {
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

    it('keep: true 플래그를 파싱한다', () => {
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

    it('keep 필드가 없으면 keep은 undefined이다', () => {
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

    it('petrify 메타데이터가 없으면 null을 반환한다', () => {
      const content = `---
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result).toBeNull();
    });

    it('source: null과 mtime: null을 파싱한다', () => {
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
});
