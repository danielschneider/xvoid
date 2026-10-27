import { getFlankedBy, hasLineOfSight, SHOT_RANGE } from '../rules/index.js';

// View data for the HUD. Reads rules through rules/index.js; no formula is duplicated here.
export function selectEnemyCounts(state) {
  const total = state.units.filter((unit) => unit.team === 'alien').length;
  const living = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).length;
  return { living, total, eliminated: total - living };
}

export function selectFlankedBy(state, unit) {
  return unit ? getFlankedBy(state, unit) : [];
}

// Whether the target can be shot at from the shooter's cell and whether it is inside SHOT_RANGE.
export function selectTargetWindow(state, shooter, target) {
  const visible = Boolean(shooter && target && hasLineOfSight(state.map, shooter, target));
  const inRange = visible && Math.hypot(shooter.x - target.x, shooter.z - target.z) <= SHOT_RANGE;
  return { visible, inRange };
}
