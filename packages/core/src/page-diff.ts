import type { PageHash } from './ports/conversion-metadata.js';

export type DiffType = 'none' | 'content-only' | 'append' | 'structural' | 'full';

export interface PageDiff {
  readonly type: DiffType;
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
}

export function diffPages(
  current: readonly PageHash[],
  saved: readonly PageHash[] | null,
): PageDiff {
  if (!saved) {
    return {
      type: 'full',
      added: current.map((p) => p.id),
      changed: [],
      removed: [],
      unchanged: [],
    };
  }

  const savedMap = new Map(saved.map((p) => [p.id, p.hash]));
  const currentMap = new Map(current.map((p) => [p.id, p.hash]));

  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];

  for (const p of current) {
    const savedHash = savedMap.get(p.id);
    if (savedHash == null) {
      added.push(p.id);
    } else if (savedHash !== p.hash) {
      changed.push(p.id);
    } else {
      unchanged.push(p.id);
    }
  }

  for (const p of saved) {
    if (!currentMap.has(p.id)) {
      removed.push(p.id);
    }
  }

  if (removed.length > 0 || !isSavedOrderPreserved(saved, current)) {
    return { type: 'structural', added, changed, removed, unchanged };
  }

  if (added.length === 0 && changed.length === 0) {
    return { type: 'none', added, changed, removed, unchanged };
  }

  if (added.length > 0) {
    return { type: 'append', added, changed, removed, unchanged };
  }

  return { type: 'content-only', added, changed, removed, unchanged };
}

/** Checks whether saved page IDs appear as a prefix of current page IDs in the same order. */
function isSavedOrderPreserved(saved: readonly PageHash[], current: readonly PageHash[]): boolean {
  const currentIds = current.map((p) => p.id);
  return saved.every((p, i) => currentIds[i] === p.id);
}
