import { describe, expect, it } from 'vitest';
import { createFrontmatter, parseFrontmatter, updateKeepInContent } from '../../src/utils/frontmatter.js';

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

  describe('updateKeepInContent', () => {
    it('keep이 없는 frontmatter에 keep: true를 추가한다', () => {
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

    it('keep: true를 제거한다', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
  keep: true
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, false);

      expect(result).not.toContain('keep');
      expect(result).toContain('# Content');
      expect(result).toContain('source: /path/to/file.note');
    });

    it('keep: false를 keep: true로 변경한다', () => {
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

    it('이미 keep: true인 상태에서 true를 설정하면 변경 없음', () => {
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

    it('frontmatter가 없는 파일은 변경 없이 그대로 반환한다', () => {
      const content = '# Just a markdown file';

      const result = updateKeepInContent(content, true);

      expect(result).toBe(content);
    });

    it('petrify 메타데이터가 없는 frontmatter는 변경 없이 반환한다', () => {
      const content = `---
excalidraw-plugin: parsed
---

# Content`;

      const result = updateKeepInContent(content, true);

      expect(result).toBe(content);
    });
  });
});
