import type { Battlefield, Position } from '../types.ts';
import { cellKey } from '../grid/cells.ts';
import { MISS_OVERSHOOT } from '../constants.ts';

// Sampling resolution along the flight line, in fields. Finer than a cell so no wall is skipped.
const SAMPLES_PER_FIELD = 10;

// Distance (in fields) a missed shot keeps flying past `target`, away from `shooter`.
// Stops before the first wall cell on the line, and never exceeds MISS_OVERSHOOT.
export function missOvershoot(
  map: Battlefield,
  shooter: Position & { level: number },
  target: Position & { level: number }
): number {
  const dx = target.x - shooter.x;
  const dz = target.z - shooter.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) return 0;
  const ux = dx / length;
  const uz = dz / length;
  const level = Math.min(shooter.level, target.level);
  const steps = MISS_OVERSHOOT * SAMPLES_PER_FIELD;
  let clear = 0;
  for (let step = 1; step <= steps; step += 1) {
    const along = step / SAMPLES_PER_FIELD;
    const x = Math.round(target.x + ux * along);
    const z = Math.round(target.z + uz * along);
    if (['wall', 'partition'].includes(map.cells[cellKey({ x, z, level })]?.terrain)) break;
    clear = step;
  }
  return clear / SAMPLES_PER_FIELD;
}
