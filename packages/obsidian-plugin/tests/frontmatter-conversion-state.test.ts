import { describe, it, expect, vi } from 'vitest';
import { FrontmatterConversionState } from '../src/frontmatter-conversion-state.js';

describe('FrontmatterConversionState', () => {
  it('파일이 존재하지 않으면 undefined를 반환한다', async () => {
    const readFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
    const state = new FrontmatterConversionState(readFile);

    const result = await state.getLastConvertedMtime('nonexistent.excalidraw.md');
    expect(result).toBeUndefined();
  });

  it('frontmatter에서 mtime을 읽는다', async () => {
    const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1700000000000
excalidraw-plugin: parsed
---

content`;
    const readFile = vi.fn().mockResolvedValue(content);
    const state = new FrontmatterConversionState(readFile);

    const result = await state.getLastConvertedMtime('file.excalidraw.md');
    expect(result).toBe(1700000000000);
  });

  it('frontmatter가 없으면 undefined를 반환한다', async () => {
    const readFile = vi.fn().mockResolvedValue('no frontmatter here');
    const state = new FrontmatterConversionState(readFile);

    const result = await state.getLastConvertedMtime('file.excalidraw.md');
    expect(result).toBeUndefined();
  });
});
