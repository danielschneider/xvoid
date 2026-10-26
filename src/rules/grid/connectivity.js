import { cellKey, isPassable, neighborsOf } from './cells.js';

// True when every passable cell (all levels) can be reached from a corner anchor.
// The anchor corner is never covered, so it is always passable.
export function allPassableReachable(cells, transitions) {
  const total = Object.values(cells).filter(isPassable).length;
  const anchor = cells[cellKey({ x: 0, z: 0 })];
  if (!isPassable(anchor)) return false;
  const seen = new Set([cellKey(anchor)]);
  const queue = [anchor];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const next of neighborsOf(queue[cursor], transitions)) {
      const key = cellKey(next);
      const cell = cells[key];
      if (seen.has(key) || !isPassable(cell)) continue;
      seen.add(key);
      queue.push(cell);
    }
  }
  return seen.size === total;
}

// Saves every cell and transition inside a building's footprint (all levels) so a
// failed placement can be undone exactly.
export function snapshotRegion(cells, transitions, room, topLevel) {
  const saved = [];
  for (let level = 0; level <= topLevel; level += 1) {
    for (let z = room.z - 1; z <= room.z + room.h; z += 1) {
      for (let x = room.x - 1; x <= room.x + room.w; x += 1) {
        const key = cellKey({ x, z, level });
        saved.push([key, cells[key] ? { ...cells[key] } : undefined, transitions[key]]);
      }
    }
  }
  return saved;
}

export function restoreRegion(cells, transitions, saved) {
  for (const [key, cell, transition] of saved) {
    if (cell) cells[key] = cell;
    else delete cells[key];
    if (transition) transitions[key] = transition;
    else delete transitions[key];
  }
}
