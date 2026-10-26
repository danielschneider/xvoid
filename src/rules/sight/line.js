import { cellKey } from '../grid/cells.js';

export function hasLineOfSight(map, from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.z - from.z));
  if (steps === 0) return true;
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(from.x + (to.x - from.x) * ratio);
    const z = Math.round(from.z + (to.z - from.z) * ratio);
    const cell = map.cells[cellKey({ x, z, level: Math.min(from.level, to.level) })];
    if (cell?.terrain === 'wall' || cell?.terrain === 'pillar') return false;
  }
  return true;
}
