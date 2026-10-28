import { cellKey } from '../cells.js';
import { isPerimeter } from './footprint.js';

// Upper floors span the full footprint. Edge cells become 'rail': non-walkable and
// see-through, so the player sees across the floor. Interior cells are 'floor'.
export function raiseFloor(cells, room, level) {
  for (let z = room.z; z < room.z + room.h; z += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      const key = cellKey({ x, z, level });
      const rail = isPerimeter(room, x, z);
      cells[key] = {
        x,
        z,
        level,
        terrain: rail ? 'rail' : 'floor',
        walkable: !rail,
        cover: 0,
        structure: true,
        corridor: false,
        building: { id: room.id, role: rail ? 'rail' : 'interior' },
      };
    }
  }
}
