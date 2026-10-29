import { getFlankedBy, hasLineOfSight, SHOT_RANGE } from '../rules/index.ts';
import type { GameState, Unit } from '../rules/types.ts';

// View data for the HUD. Reads rules through rules/index.ts; no formula is duplicated here.
export function selectEnemyCounts(state: GameState) {
  const total = state.units.filter((unit) => unit.team === 'alien').length;
  const living = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).length;
  return { living, total, eliminated: total - living };
}

export function selectFlankedBy(state: GameState, unit: Unit | null | undefined): Unit[] {
  return unit ? getFlankedBy(state, unit) : [];
}

// Whether the target can be shot at from the shooter's cell and whether it is inside SHOT_RANGE.
export function selectTargetWindow(
  state: GameState,
  shooter: Unit | null | undefined,
  target: Unit | null | undefined
): { visible: boolean; inRange: boolean } {
  if (!shooter || !target) return { visible: false, inRange: false };
  const visible = hasLineOfSight(state.map, shooter, target);
  const inRange = visible && Math.hypot(shooter.x - target.x, shooter.z - target.z) <= SHOT_RANGE;
  return { visible, inRange };
}
