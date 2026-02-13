import { describe, expect, it } from 'vitest';
import { diffPages } from '../src/page-diff.js';
import type { PageHash } from '../src/ports/conversion-metadata.js';

function page(id: string, hash: string): PageHash {
  return { id, hash };
}

describe('diffPages', () => {
  it('treats all pages as added when savedHashes is null', () => {
    const current = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, null);
    expect(diff.added).toEqual(['p1', 'p2']);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.type).toBe('full');
  });

  it('detects no changes', () => {
    const current = [page('p1', 'aaa'), page('p2', 'bbb')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('none');
    expect(diff.unchanged).toEqual(['p1', 'p2']);
  });

  it('detects content-only changes', () => {
    const current = [page('p1', 'aaa'), page('p2', 'CHANGED')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('content-only');
    expect(diff.changed).toEqual(['p2']);
    expect(diff.unchanged).toEqual(['p1']);
  });

  it('detects append', () => {
    const current = [page('p1', 'aaa'), page('p2', 'bbb'), page('p3', 'ccc')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('append');
    expect(diff.added).toEqual(['p3']);
    expect(diff.unchanged).toEqual(['p1', 'p2']);
  });

  it('detects append with content change', () => {
    const current = [page('p1', 'aaa'), page('p2', 'CHANGED'), page('p3', 'ccc')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('append');
    expect(diff.added).toEqual(['p3']);
    expect(diff.changed).toEqual(['p2']);
    expect(diff.unchanged).toEqual(['p1']);
  });

  it('detects structural change on middle insert', () => {
    const current = [page('p1', 'aaa'), page('new', 'xxx'), page('p2', 'bbb')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('structural');
  });

  it('detects structural change on deletion', () => {
    const current = [page('p1', 'aaa')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('structural');
    expect(diff.removed).toEqual(['p2']);
  });

  it('detects structural change on reorder', () => {
    const current = [page('p2', 'bbb'), page('p1', 'aaa')];
    const saved = [page('p1', 'aaa'), page('p2', 'bbb')];
    const diff = diffPages(current, saved);
    expect(diff.type).toBe('structural');
  });
});
