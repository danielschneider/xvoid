import type { Battlefield, Cell, Position } from '../types.ts';
import { cellKey, isPassable, neighborsOf } from './cells.ts';

// Proves, without a full-map search, that blocking `cell` keeps every passable cell
// connected. Precondition: the map is fully connected before `cell` is blocked (the
// generator guarantees this, since every accepted placement passed the full check).
//
// Returns true only when the passable neighbours of `cell` are all linked to each other
// without passing through `cell`. Any path through `cell` can then be rerouted around
// it, so the map stays connected. Returns false when the proof is not found; the caller
// must then run the exact global check. A false result never means "disconnected".
export function neighboursStayLinked(
  cells: Battlefield['cells'],
  transitions: Battlefield['transitions'],
  cell: Cell
): boolean {
  const blocked = cellKey(cell);
  const targets = new Set<string>();
  for (const next of neighborsOf(cell, transitions)) {
    const key = cellKey(next);
    if (key !== blocked && isPassable(cells[key])) targets.add(key);
  }
  if (targets.size <= 1) return true;

  const start = targets.values().next().value as string;
  const seen = new Set<string>([start, blocked]);
  const queue: Position[] = [cells[start]];
  targets.delete(start);
  for (let cursor = 0; cursor < queue.length && targets.size > 0; cursor += 1) {
    for (const next of neighborsOf(queue[cursor], transitions)) {
      const key = cellKey(next);
      if (seen.has(key) || !isPassable(cells[key])) continue;
      seen.add(key);
      targets.delete(key);
      queue.push(cells[key]);
    }
  }
  return targets.size === 0;
}
