import { describe, expect, it } from 'vitest';
import { sha1Hex } from '../src/hash.js';

describe('sha1Hex', () => {
  it('returns 40-character hex string', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const hash = await sha1Hex(data);
    expect(hash).toHaveLength(40);
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns same hash for same input', async () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(await sha1Hex(data)).toBe(await sha1Hex(data));
  });

  it('returns different hash for different input', async () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    expect(await sha1Hex(a)).not.toBe(await sha1Hex(b));
  });

  it('hashes ArrayBuffer', async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    const hash = await sha1Hex(new Uint8Array(data));
    expect(hash).toHaveLength(40);
  });
});
