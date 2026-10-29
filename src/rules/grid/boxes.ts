import type { Cell, Cover, Position, Room } from '../types.ts';
import { cellKey } from './cells.ts';
import { allPassableReachable } from './connectivity.ts';
import { neighboursStayLinked } from './blockCheck.ts';
import type { MapTheme } from './themes.ts';

// Places a box only if the battlefield stays connected and no protected cell is touched.
function placeBox(
  cells: Record<string, Cell>,
  transitions: Record<string, Position[]>,
  cell: Cell,
  cover: Cover,
  protectedKeys: Set<string>
): void {
  if (protectedKeys.has(cellKey(cell))) return;
  const previous = { cover: cell.cover, terrain: cell.terrain };
  cell.cover = cover;
  cell.terrain = cover === 2 ? 'pillar' : 'console';
  // Local proof first; the exact full-map check runs only when the proof is inconclusive.
  if (neighboursStayLinked(cells, transitions, cell)) return;
  if (!allPassableReachable(cells, transitions)) Object.assign(cell, previous);
}

// Box placement runs after all structure exists, so the connectivity guard sees the
// real map. Protected keys (stairs, lanes) are never overwritten.
export function placeBoxes(
  cells: Record<string, Cell>,
  transitions: Record<string, Position[]>,
  rooms: Room[],
  size: number,
  theme: MapTheme,
  random: () => number,
  protectedKeys: Set<string>
): void {
  // Inside buildings: ground floor first, then upper floors.
  for (const room of rooms) {
    for (let z = room.z + 1; z < room.z + room.h - 1; z += 1) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
        const cell = cells[cellKey({ x, z })];
        if (random() < theme.buildingBoxChance && cell.terrain === 'floor') {
          placeBox(cells, transitions, cell, random() < theme.buildingFullCover ? 2 : 1, protectedKeys);
        }
      }
    }
  }
  for (const cell of Object.values(cells)) {
    if (
      cell.level > 0 &&
      cell.terrain === 'floor' &&
      cell.building?.role === 'interior' &&
      random() < theme.upperFloorBoxChance
    ) {
      placeBox(cells, transitions, cell, random() < theme.buildingFullCover ? 2 : 1, protectedKeys);
    }
  }

  // Open ground: scattered boxes on a sparse, offset pattern.
  for (let index = 0; index < Math.floor((size * size) / theme.scatterDivisor); index += 1) {
    const x = 2 + Math.floor(random() * (size - 4));
    const z = 2 + Math.floor(random() * (size - 4));
    const cell = cells[cellKey({ x, z })];
    if (cell?.walkable && !cell.structure && cell.cover === 0 && (x + z) % 3 !== 0) {
      placeBox(cells, transitions, cell, random() < theme.scatterFullCover ? 2 : 1, protectedKeys);
    }
  }
}
