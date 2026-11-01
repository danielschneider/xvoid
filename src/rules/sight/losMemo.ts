import type { Battlefield, Position } from '../types.ts';

// Memo of line-of-sight answers per map. Terrain is fixed after generation, so an answer
// for the same endpoints never changes. Keyed by the Battlefield object, so a new map
// starts with an empty cache and nothing needs to be invalidated by hand.
const memos = new WeakMap<Battlefield, Map<string, boolean>>();

function memoFor(map: Battlefield): Map<string, boolean> {
  let memo = memos.get(map);
  if (!memo) {
    memo = new Map();
    memos.set(map, memo);
  }
  return memo;
}

export function getMemoLos(
  map: Battlefield,
  from: Position & { level: number },
  to: Position & { level: number }
): boolean | undefined {
  return memoFor(map).get(losKey(from, to));
}

export function setMemoLos(
  map: Battlefield,
  from: Position & { level: number },
  to: Position & { level: number },
  visible: boolean
): void {
  memoFor(map).set(losKey(from, to), visible);
}

// Directed key. Sampling starts at the origin, so A->B and B->A can round differently at
// exact cell boundaries; keeping direction makes cached answers identical to uncached ones.
function losKey(from: Position & { level: number }, to: Position & { level: number }): string {
  return `${from.x},${from.z},${from.level}>${to.x},${to.z},${to.level}`;
}
