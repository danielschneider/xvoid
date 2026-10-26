// Compatibility facade: map logic now lives in src/rules/{grid,movement,sight,combat}.
export { FOG_REVEAL_RANGE, VISION_RANGE } from '../rules/constants.js';
export { BLOCKING_TERRAIN, cellHeight, cellKey, isPassable } from '../rules/grid/cells.js';
export { createBattlefield, GRID_SIZES, MAX_BUILDING_LEVEL } from '../rules/grid/generate.js';
export { getReachable } from '../rules/movement/pathfinding.js';
export { hasLineOfSight } from '../rules/sight/line.js';
export { getVisibleCells } from '../rules/sight/fog.js';
export { getCoverAgainst, getCoverProfile, getSideCover } from '../rules/combat/cover.js';
