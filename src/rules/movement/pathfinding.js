import { AP_MOVE_CHEAP, AP_MOVE_FULL, DEFAULT_MOVE_RANGE } from '../constants.js';
import { cellKey, isPassable, neighborsOf } from '../grid/cells.js';

export function getReachable(map, start, blocked = new Set(), maxSteps = DEFAULT_MOVE_RANGE, cheapSteps = Math.ceil(DEFAULT_MOVE_RANGE / 2)) {
  const startKey = cellKey(start);
  const queue = [start];
  const distance = new Map([[startKey, 0]]);
  const previous = new Map();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentKey = cellKey(current);
    const currentDistance = distance.get(currentKey);

    for (const next of neighborsOf(current, map.transitions)) {
      const nextKey = cellKey(next);
      const cell = map.cells[nextKey];
      if (!isPassable(cell) || blocked.has(nextKey) || distance.has(nextKey) || currentDistance >= maxSteps) continue;
      distance.set(nextKey, currentDistance + 1);
      previous.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  const paths = new Map();
  for (const [key, steps] of distance) {
    if (key === startKey) continue;
    const path = [];
    let cursor = key;
    while (cursor !== startKey) {
      path.unshift(map.cells[cursor]);
      cursor = previous.get(cursor);
    }
    paths.set(key, { steps, path, apCost: steps <= cheapSteps ? AP_MOVE_CHEAP : AP_MOVE_FULL });
  }
  return paths;
}
