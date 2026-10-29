import type { Position } from '../types.ts';
import { spawnDistance } from '../geometry.ts';

// Rear arc for sneaking: a cell counts as "behind" a player when it lies in the
// half-plane opposite the player's facing. Cells beside the player (within the
// side arc) do not count, so the sneaker keeps moving around to the back.
const REAR_COS_THRESHOLD = -0.5;

// Unit vector the player is looking along. Falls back to +z when facing is unset.
function forwardVector(unit: Position & { facing?: number }): Position {
  const angle = unit.facing ?? 0;
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

// True when `cell` is inside the rear arc of `target`.
export function isBehind(target: Position & { facing?: number }, cell: Position): boolean {
  const dx = cell.x - target.x;
  const dz = cell.z - target.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) return false;
  const forward = forwardVector(target);
  return (dx * forward.x + dz * forward.z) / length <= REAR_COS_THRESHOLD;
}

// Distance from `cell` to the closest rear-arc point of `target`, used to rank
// destinations when none is yet behind. Lower is better.
export function rearDistance(target: Position & { facing?: number }, cell: Position): number {
  if (isBehind(target, cell)) return 0;
  const forward = forwardVector(target);
  // Distance to the rear point the cell is currently closest to (opposite facing, one cell back).
  const rearPoint = { x: target.x - forward.x * 2, z: target.z - forward.z * 2 };
  return spawnDistance(cell, rearPoint);
}
