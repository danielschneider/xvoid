import { cellKey, isPassable, neighborsOf } from '../cells.js';

// Passable cells of `room` on `level` must all be reachable from `start`, moving through
// doors, stairs and floors. Only cells inside the footprint are counted, so other
// buildings on the same level do not affect the result.
export function floorReachable(cells, transitions, room, level, start) {
  const inside = (cell) =>
    cell.level === level &&
    cell.x >= room.x &&
    cell.x < room.x + room.w &&
    cell.z >= room.z &&
    cell.z < room.z + room.h;
  const total = Object.values(cells).filter((cell) => inside(cell) && isPassable(cell)).length;
  const startKey = cellKey({ ...start, level });
  if (!isPassable(cells[startKey])) return false;
  const seen = new Set([startKey]);
  const queue = [cells[startKey]];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const next of neighborsOf(queue[cursor], transitions)) {
      const key = cellKey(next);
      if (seen.has(key) || !isPassable(cells[key])) continue;
      seen.add(key);
      queue.push(cells[key]);
    }
  }
  let reached = 0;
  for (const key of seen) if (inside(cells[key])) reached += 1;
  return reached === total;
}

// Lane cells must still be walkable after box placement.
export function lanesOpen(cells, lanes) {
  for (const key of lanes) {
    if (!isPassable(cells[key])) return false;
  }
  return true;
}
