import { cellKey } from '../cells.ts';
import type { Cell, Position, Room } from '../../types.ts';

// Two stair access points per upper floor, on diagonally opposite interior corners.
// Each access point is a single stair cell per floor, linked vertically through
// `transitions` (both directions), so a blocked corner cannot cut off a floor.

export function stairCorners(room) {
  const left = room.x + 1;
  const right = room.x + room.w - 2;
  const top = room.z + 1;
  const bottom = room.z + room.h - 2;
  return [
    { x: left, z: top },
    { x: right, z: bottom },
  ];
}

// Marks stair cells and links floor N to N+1. Returns the stair cell keys per level.
export function placeStairs(
  cells: Record<string, Cell>,
  transitions: Record<string, Position[]>,
  room: Room,
  topLevel: number
): Set<string> {
  const keys = new Set<string>();
  for (const corner of stairCorners(room)) {
    for (let level = 0; level <= topLevel; level += 1) {
      const key = cellKey({ ...corner, level });
      cells[key].terrain = 'stairs';
      cells[key].building = { ...(cells[key].building || {}), role: 'stair' };
      keys.add(key);
    }
    for (let level = 0; level < topLevel; level += 1) {
      const lower = cellKey({ ...corner, level });
      const upper = cellKey({ ...corner, level: level + 1 });
      transitions[lower] = [...(transitions[lower] || []), { x: corner.x, z: corner.z, level: level + 1 }];
      transitions[upper] = [...(transitions[upper] || []), { x: corner.x, z: corner.z, level }];
    }
  }
  return keys;
}
