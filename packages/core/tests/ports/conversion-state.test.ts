import { describe, it, expect } from 'vitest';
import type { ConversionStatePort } from '../../src/ports/conversion-state.js';

describe('ConversionStatePort', () => {
  it('변환 이력이 없으면 undefined를 반환한다', async () => {
    const state: ConversionStatePort = {
      getLastConvertedMtime: async () => undefined,
    };

    const result = await state.getLastConvertedMtime('unknown-id');
    expect(result).toBeUndefined();
  });

  it('변환 이력이 있으면 mtime을 반환한다', async () => {
    const store = new Map<string, number>([['file-1', 1700000000000]]);

    const state: ConversionStatePort = {
      getLastConvertedMtime: async (id) => store.get(id),
    };

    const result = await state.getLastConvertedMtime('file-1');
    expect(result).toBe(1700000000000);
  });
});
