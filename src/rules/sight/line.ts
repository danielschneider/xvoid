import type { Battlefield, Position } from '../types.ts';
import { cellKey } from '../grid/cells.ts';

// Terrain that stops sight. Rails are see-through; boxes give cover instead.
const SIGHT_BLOCKERS = new Set(['wall', 'partition']);

// Units can lean: head and weapon may reach the corners of their own cell. A ray that starts
// or ends at a corner passes a wall that ends beside the unit, so the unit can shoot or
// look around the corner. Insets stay inside the cell, so the lean never reaches a neighbour.
const LEAN_INSET = 0.45;
const LEAN_POINTS: [number, number][] = [
  [0, 0],
  [-LEAN_INSET, -LEAN_INSET],
  [LEAN_INSET, -LEAN_INSET],
  [-LEAN_INSET, LEAN_INSET],
  [LEAN_INSET, LEAN_INSET],
];
// Ray samples per cell. Finer than a cell so a thin wall end is never skipped.
const SAMPLES_PER_CELL = 4;

// Whether a straight ray from one point to another is free of sight blockers.
// Points are continuous; each sample is rounded to the cell it lands in.
export function isRayClear(
  map: Battlefield,
  from: { x: number; z: number },
  to: { x: number; z: number },
  level: number
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * SAMPLES_PER_CELL);
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(from.x + dx * ratio);
    const z = Math.round(from.z + dz * ratio);
    // Only walls block sight. Boxes (pillar/console) give cover, which lowers the hit chance
    // in cover.ts instead of making the target unshootable.
    if (SIGHT_BLOCKERS.has(map.cells[cellKey({ x, z, level })]?.terrain)) return false;
  }
  return true;
}

// Line of sight with leaning: visible when any lean point of `from` sees any lean point of `to`.
export function hasLineOfSight(
  map: Battlefield,
  from: Position & { level: number },
  to: Position & { level: number }
): boolean {
  if (from.x === to.x && from.z === to.z) return true;
  const level = Math.min(from.level, to.level);
  return LEAN_POINTS.some(([ox, oz]) =>
    LEAN_POINTS.some(([tx, tz]) =>
      isRayClear(map, { x: from.x + ox, z: from.z + oz }, { x: to.x + tx, z: to.z + tz }, level)
    )
  );
}
