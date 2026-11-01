import type { Battlefield, Position } from '../types.ts';
import { getBlockerGrid, isSightBlocked, type BlockerGrid } from './blockerGrid.ts';
import { getMemoLos, setMemoLos } from './losMemo.ts';

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

// Whether a straight ray from one point to another is free of sight blockers.
// Points are continuous; each sample is rounded to the cell it lands in.
export function isRayClear(
  map: Battlefield,
  from: { x: number; z: number },
  to: { x: number; z: number },
  level: number
): boolean {
  return rayClear(getBlockerGrid(map), from, to, level);
}

function rayClear(
  grid: BlockerGrid,
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
    if (isSightBlocked(grid, from.x + dx * ratio, from.z + dz * ratio, level)) return false;
  }
  return true;
}

// Lean points of a unit at (x, z) that do not sit inside a sight blocker.
function leanPoints(grid: BlockerGrid, x: number, z: number, level: number) {
  const points: { x: number; z: number }[] = [];
  for (const [ox, oz] of LEAN_POINTS) {
    const px = x + ox;
    const pz = z + oz;
    if (!isSightBlocked(grid, px, pz, level)) points.push({ x: px, z: pz });
  }
  points.push({ x, z });
  return points;
}

// Line of sight with leaning: visible when any lean point of `from` sees any lean point of `to`.
export function hasLineOfSight(
  map: Battlefield,
  from: Position & { level: number },
  to: Position & { level: number }
): boolean {
  if (from.x === to.x && from.z === to.z) return true;
  const cached = getMemoLos(map, from, to);
  if (cached !== undefined) return cached;
  const grid = getBlockerGrid(map);
  const level = Math.min(from.level, to.level);
  const toPoints = leanPoints(grid, to.x, to.z, level);
  const visible = leanPoints(grid, from.x, from.z, level).some((origin) =>
    toPoints.some((end) => rayClear(grid, origin, end, level))
  );
  setMemoLos(map, from, to, visible);
  return visible;
}
