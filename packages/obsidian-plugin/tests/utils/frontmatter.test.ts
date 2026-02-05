import { describe, it, expect } from 'vitest';
import {
  createFrontmatter,
  parseFrontmatter,
} from '../../src/utils/frontmatter.js';

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
  });
});
