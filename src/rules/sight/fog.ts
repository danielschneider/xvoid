import type { Battlefield, Cell, Unit } from '../types.ts';
import { FOG_REVEAL_RANGE } from '../constants.ts';
import { cellKey, isPassable } from '../grid/cells.ts';
import { hasLineOfSight } from './line.ts';

// Fog sight is more forgiving than combat LOS: a cell counts as seen when any ray from
// the observer (leaning, see line.ts) reaches the cell's centre or inset corners.
const SIGHT_INSET = 0.45;
const SIGHT_OFFSETS = [
  [0, 0],
  [-SIGHT_INSET, -SIGHT_INSET],
  [SIGHT_INSET, -SIGHT_INSET],
  [-SIGHT_INSET, SIGHT_INSET],
  [SIGHT_INSET, SIGHT_INSET],
];

function canSeeCell(map: Battlefield, observer: Unit, cell: Cell): boolean {
  const level = Math.min(observer.level, cell.level);
  return SIGHT_OFFSETS.some(([ox, oz]) =>
    hasLineOfSight(
      map,
      { x: observer.x, z: observer.z, level: observer.level },
      { x: cell.x + ox, z: cell.z + oz, level }
    )
  );
}

const SOLID_TERRAIN = new Set(['wall', 'partition', 'pillar', 'console']);
const COVER_BOXES = new Set(['pillar', 'console']);
const SIGHT_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Whether any observer sees the cell directly (range plus a clear sight ray).
function seenDirectly(map: Battlefield, observers: Unit[], cell: Cell): boolean {
  return observers.some(
    (unit) => Math.hypot(unit.x - cell.x, unit.z - cell.z) <= FOG_REVEAL_RANGE && canSeeCell(map, unit, cell)
  );
}

// Visibility of one cell, computed without scanning the whole map. Same result as
// getVisibleCells(map, units).has(cellKey(cell)).
export function isCellVisible(map: Battlefield, units: Unit[], cell: Cell): boolean {
  const observers = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  if (seenDirectly(map, observers, cell)) return true;
  if (!isPassable(cell)) return false;
  return SIGHT_DIRECTIONS.some(([dx, dz]) => {
    const box = map.cells[cellKey({ x: cell.x + dx, z: cell.z + dz, level: cell.level })];
    const beyond = map.cells[cellKey({ x: cell.x - dx, z: cell.z - dz, level: cell.level })];
    if (!box || !COVER_BOXES.has(box.terrain) || !SOLID_TERRAIN.has(beyond?.terrain)) return false;
    return seenDirectly(map, observers, box);
  });
}

export function getVisibleCells(map: Battlefield, units: Unit[]): Set<string> {
  const observers = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visible = new Set<string>();
  for (const cell of Object.values(map.cells)) {
    if (seenDirectly(map, observers, cell)) visible.add(cellKey(cell));
  }
  // Floor between a seen cover box and the solid cell behind it is also seen. The wall
  // behind a box is itself hidden by the box, so only the box must be visible.
  for (const cell of Object.values(map.cells)) {
    const key = cellKey(cell);
    if (visible.has(key) || !isPassable(cell)) continue;
    const behindBox = SIGHT_DIRECTIONS.some(([dx, dz]) => {
      const box = map.cells[cellKey({ x: cell.x + dx, z: cell.z + dz, level: cell.level })];
      const beyond = map.cells[cellKey({ x: cell.x - dx, z: cell.z - dz, level: cell.level })];
      if (!box) return false;
      return visible.has(cellKey(box)) && COVER_BOXES.has(box.terrain) && SOLID_TERRAIN.has(beyond?.terrain);
    });
    if (behindBox) visible.add(key);
  }
  return visible;
}
