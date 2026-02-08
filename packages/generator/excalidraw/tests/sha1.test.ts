import { describe, expect, it } from 'vitest';
import { sha1Hex } from '../src/sha1.js';

describe('sha1Hex', () => {
  it('computes SHA-1 hash of empty data', async () => {
    const empty = new Uint8Array([]);
    const hash = await sha1Hex(empty);

    expect(hash).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('computes SHA-1 hash of known data', async () => {
    const data = new TextEncoder().encode('hello');
    const hash = await sha1Hex(data);

    expect(hash).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('returns a 40-character hex string', async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const hash = await sha1Hex(data);

    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('produces the same hash for the same input', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const hash1 = await sha1Hex(data);
    const hash2 = await sha1Hex(data);

    expect(hash1).toBe(hash2);
  });
});
