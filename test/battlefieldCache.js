import { createBattlefield } from '../src/rules/grid/generate.ts';

// Per-process memo of generated battlefields, keyed by seed. Generation is the dominant
// test cost (about 150 ms per seed). Each call returns a structured clone, so tests that
// mutate the map (for example setSides) never affect other callers.
const cache = new Map();

export function cachedBattlefield(seed) {
  if (!cache.has(seed)) cache.set(seed, createBattlefield(seed));
  return structuredClone(cache.get(seed));
}
