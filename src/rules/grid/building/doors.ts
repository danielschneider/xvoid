import type { Room } from '../../types.ts';
import { cellKey } from '../cells.ts';
import { doorCells, oppositeSide, type Side } from './footprint.ts';

// Chooses door sides for a building: main door faces the corridor row/column nearest the
// building, plus an optional second door on the opposite side. Returns { sides, width }.
export function chooseDoors(
  room: Room,
  middle: number,
  anchor: boolean,
  random: () => number
): { sides: Side[]; width: number } {
  const width = anchor ? 3 : 2;
  const centreX = room.x + room.w / 2;
  const centreZ = room.z + room.h / 2;
  // Face the corridor: the side whose adjacent corridor is closest to the building centre.
  const horizontal = Math.abs(centreX - middle) >= Math.abs(centreZ - middle);
  let main: Side;
  if (horizontal) main = centreX < middle ? 'east' : 'west';
  else main = centreZ < middle ? 'south' : 'north';
  const sides: Side[] = [main];
  if (random() < 0.5) sides.push(oppositeSide(main));
  return { sides, width };
}

// Lane cells just inside each door (one cell deep). Box placement must not block these.
export function laneKeys(room: Room, sides: Side[], width: number): Set<string> {
  const lane = new Set<string>();
  for (const side of sides) {
    for (const cell of doorCells(room, side, width)) {
      const inside: Record<Side, { x: number; z: number }> = {
        north: { x: cell.x, z: cell.z + 1 },
        south: { x: cell.x, z: cell.z - 1 },
        west: { x: cell.x + 1, z: cell.z },
        east: { x: cell.x - 1, z: cell.z },
      };
      const target = inside[side];
      lane.add(cellKey({ ...target, level: 0 }));
    }
  }
  return lane;
}
