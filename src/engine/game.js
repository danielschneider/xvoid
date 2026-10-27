// Compatibility facade: rules engine now lives in src/rules/{spawn,movement,combat,ai,turns}.
export {
  SHOT_RANGE,
  ENEMY_SHOT_RANGE,
  OVERWATCH_RANGE,
  ENEMY_COVER_FACTOR,
  COVER_VALUE,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
} from '../rules/constants.js';
export { cellKey, getReachable, hasLineOfSight } from './map.js';
export { movementLimits } from '../rules/movement/moveUnit.js';
export {
  computeCoverFor,
  computeDistanceModifier,
  computeCritChance,
  computeHitChance,
  computePlayerHitParts,
  getFlankedBy,
} from '../rules/combat/hitChance.js';
export { createInitialState } from '../rules/spawn/initialState.js';
export { gameReducer } from '../rules/turns/reducer.js';
