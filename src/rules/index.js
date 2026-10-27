// Public API of rules/. UI code and selectors import from here only (see eslint.config.js).
// Re-exports only: no logic lives in this file.
export { SHOT_RANGE } from './constants.js';
export { cellKey, cellHeight } from './grid/cells.js';
export { createInitialState } from './spawn/initialState.js';
export { gameReducer } from './turns/reducer.js';
export { getNextReadyUnit } from './turns/readyUnit.js';
export { getReachable } from './movement/pathfinding.js';
export { movementLimits } from './movement/moveUnit.js';
export { computeHitChance, computePlayerHitParts, getFlankedBy } from './combat/hitChance.js';
export { getCoverAgainst, getCoverProfile, getSideCover } from './combat/cover.js';
export { hasLineOfSight } from './sight/line.js';
export { getVisibleCells } from './sight/fog.js';
