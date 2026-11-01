import type { Battlefield, Position } from '../types.ts';
import { cellKey } from '../grid/cells.ts';

// Terrain that stops sight. Rails are see-through; boxes give cover instead.
const SIGHT_BLOCKERS = new Set(['wall', 'partition']);

// Units can lean out from cover: head and weapon reach a little past their own cell edge,
// so a unit beside a wall end can look and shoot around it. A lean point may not sit inside
// a sight blocker, so a lean never pokes through solid terrain.
const LEAN_REACH = 0.49;
const LEAN_POINTS: [number, number][] = [
  [0, 0],
  [-LEAN_REACH, 0],
  [LEAN_REACH, 0],
  [0, -LEAN_REACH],
  [0, LEAN_REACH],
  [-LEAN_REACH, -LEAN_REACH],
  [LEAN_REACH, -LEAN_REACH],
  [-LEAN_REACH, LEAN_REACH],
  [LEAN_REACH, LEAN_REACH],
];
// Ray samples per cell. Finer than a cell so a thin wall end is never skipped.
const SAMPLES_PER_CELL = 4;

const isBlockedAt = (map: Battlefield, x: number, z: number, level: number): boolean =>
  SIGHT_BLOCKERS.has(map.cells[cellKey({ x: Math.round(x), z: Math.round(z), level })]?.terrain);

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
    // Only walls block sight. Boxes (pillar/console) give cover, which lowers the hit chance
    // in cover.ts instead of making the target unshootable.
    if (isBlockedAt(map, from.x + dx * ratio, from.z + dz * ratio, level)) return false;
  }
  return true;
}

// Lean points of a unit at (x, z) that do not sit inside a sight blocker.
function leanPoints(map: Battlefield, x: number, z: number, level: number) {
  return LEAN_POINTS.map(([ox, oz]) => ({ x: x + ox, z: z + oz }))
    .filter((point) => !isBlockedAt(map, point.x, point.z, level))
    .concat([{ x, z }]);
}

// Line of sight with leaning: visible when any lean point of `from` sees any lean point of `to`.
export function hasLineOfSight(
  map: Battlefield,
  from: Position & { level: number },
  to: Position & { level: number }
): boolean {
  if (from.x === to.x && from.z === to.z) return true;
  const level = Math.min(from.level, to.level);
  const toPoints = leanPoints(map, to.x, to.z, level);
  return leanPoints(map, from.x, from.z, level).some((origin) =>
    toPoints.some((end) => isRayClear(map, origin, end, level))
  );
}
