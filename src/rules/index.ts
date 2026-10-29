// Public API of rules/. UI code and selectors import from here only (see eslint.config.js).
// Re-exports only: no logic lives in this file.
export { SHOT_RANGE } from './constants.ts';
export { cellKey, cellHeight } from './grid/cells.ts';
export { createInitialState } from './spawn/initialState.ts';
export { gameReducer } from './turns/reducer.ts';
export { getNextReadyUnit } from './turns/readyUnit.ts';
export { getReachable } from './movement/pathfinding.ts';
export { movementLimits } from './movement/moveUnit.ts';
export { computeHitChance, computePlayerHitParts, getFlankedBy } from './combat/hitChance.ts';
export { getCoverAgainst, getCoverProfile, getSideCover } from './combat/cover.ts';
export { hasLineOfSight } from './sight/line.ts';
export { getVisibleCells } from './sight/fog.ts';
