import type { Battlefield, Cell, Position, Unit } from '../types.ts';
import { FOG_REVEAL_RANGE } from '../constants.ts';
import { cellKey, isPassable } from '../grid/cells.ts';

// Fog sight is more forgiving than combat LOS: a cell counts as seen when any ray from
// the observer to the cell's centre or inset corners is clear. This keeps floor beside
// a box or wall visible instead of being hidden by a single rounded centre line.
const SIGHT_INSET = 0.45;
const SIGHT_OFFSETS = [
  [0, 0],
  [-SIGHT_INSET, -SIGHT_INSET],
  [SIGHT_INSET, -SIGHT_INSET],
  [-SIGHT_INSET, SIGHT_INSET],
  [SIGHT_INSET, SIGHT_INSET],
];

function hasSightRay(map: Battlefield, from: Position, targetX: number, targetZ: number, level: number): boolean {
  const dx = targetX - from.x;
  const dz = targetZ - from.z;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * 4);
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(from.x + dx * ratio);
    const z = Math.round(from.z + dz * ratio);
    const cell = map.cells[cellKey({ x, z, level })];
    // Boxes give cover, not blindness: only walls stop sight (see line.js).
    if (cell?.terrain === 'wall' || cell?.terrain === 'partition') return false;
  }
  return true;
}

function canSeeCell(map: Battlefield, observer: Unit, cell: Cell): boolean {
  const level = Math.min(observer.level, cell.level);
  return SIGHT_OFFSETS.some(([ox, oz]) => hasSightRay(map, observer, cell.x + ox, cell.z + oz, level));
}

const SOLID_TERRAIN = new Set(['wall', 'partition', 'pillar', 'console']);
const SIGHT_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function getVisibleCells(map: Battlefield, units: Unit[]): Set<string> {
  const observers = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visible = new Set<string>();
  for (const cell of Object.values(map.cells)) {
    if (
      observers.some(
        (unit) => Math.hypot(unit.x - cell.x, unit.z - cell.z) <= FOG_REVEAL_RANGE && canSeeCell(map, unit, cell)
      )
    )
      visible.add(cellKey(cell));
  }
  // Floor between a seen cover box and the solid cell behind it is also seen. The wall
  // behind a box is itself hidden by the box, so only the box must be visible.
  const COVER_BOXES = new Set(['pillar', 'console']);
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
