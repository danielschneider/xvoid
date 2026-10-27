import { cellKey } from '../src/rules/grid/cells.js';
import { hasLineOfSight } from '../src/rules/sight/line.js';
import { makeRandom } from '../src/rules/rng.js';

// Shared test builders. Pure helpers only; no assertions.

export function adjacentWalkableCell(map, unit) {
  return Object.values(map.cells).find((cell) => (
    cell.level === unit.level
    && cell.walkable
    && Math.abs(cell.x - unit.x) + Math.abs(cell.z - unit.z) === 1
    && hasLineOfSight(map, unit, cell)
  ));
}

export function isolateEncounter(state, keep) {
  return { ...state, units: state.units.map((unit) => (keep[unit.id] ? { ...unit, ...keep[unit.id] } : { ...unit, hp: 0 })) };
}

export const setSides = (state, { x, z }, sides) => {
  const offsets = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const [side, [dx, dz]] of Object.entries(offsets)) {
    state.map.cells[cellKey({ x: x + dx, z: z + dz, level: 0 })].cover = sides[side] ?? 0;
  }
};

// Finds an RNG cursor whose next draws fall in the given buckets: 0 means [0, 0.01),
// any other value v means [v, v + 0.01). Draws are consumed in order by the reducer.
export function withDraws(state, targets) {
  for (let cursor = 1; ; cursor += 1) {
    const random = makeRandom(cursor);
    if (targets.every((target) => {
      const value = random();
      return target === 0 ? value < 0.01 : value >= target && value < target + 0.01;
    })) return { ...state, rng: cursor };
  }
}
