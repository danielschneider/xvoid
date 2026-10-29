import { DEFAULT_MOVE_RANGE } from '../constants.ts';
import type { Battlefield, Cell, Position } from '../types.ts';
import { cellKey, isPassable, neighborsOf } from '../grid/cells.ts';

// A reachable cell: steps walked, the cells on the way (start excluded, destination last), and AP spent.
export interface ReachablePath {
  steps: number;
  path: Cell[];
  apCost: number;
}

export function getReachable(
  map: Battlefield,
  start: Position,
  blocked: Set<string> = new Set(),
  maxSteps: number = DEFAULT_MOVE_RANGE,
  stepsPerAp: number = DEFAULT_MOVE_RANGE
): Map<string, ReachablePath> {
  const startKey = cellKey(start);
  const queue: Position[] = [start];
  const distance = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentKey = cellKey(current);
    const currentDistance = distance.get(currentKey) ?? 0;

    for (const next of neighborsOf(current, map.transitions)) {
      const nextKey = cellKey(next);
      const cell = map.cells[nextKey];
      if (!isPassable(cell) || blocked.has(nextKey) || distance.has(nextKey) || currentDistance >= maxSteps) continue;
      distance.set(nextKey, currentDistance + 1);
      previous.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  const paths = new Map<string, ReachablePath>();
  for (const [key, steps] of distance) {
    if (key === startKey) continue;
    const path: Cell[] = [];
    let cursor: string | undefined = key;
    while (cursor !== undefined && cursor !== startKey) {
      path.unshift(map.cells[cursor]);
      cursor = previous.get(cursor);
    }
    paths.set(key, { steps, path, apCost: Math.ceil(steps / stepsPerAp) });
  }
  return paths;
}
