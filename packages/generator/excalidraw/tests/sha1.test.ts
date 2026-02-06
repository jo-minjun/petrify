import { describe, expect, it } from 'vitest';
import { sha1Hex } from '../src/sha1.js';

describe('sha1Hex', () => {
  it('빈 데이터의 SHA-1 해시', async () => {
    const empty = new Uint8Array([]);
    const hash = await sha1Hex(empty);

    expect(hash).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('알려진 데이터의 SHA-1 해시', async () => {
    const data = new TextEncoder().encode('hello');
    const hash = await sha1Hex(data);

    expect(hash).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('결과가 40자 hex 문자열', async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const hash = await sha1Hex(data);

    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('동일 입력이면 동일 해시', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const hash1 = await sha1Hex(data);
    const hash2 = await sha1Hex(data);

    expect(hash1).toBe(hash2);
  });
});
