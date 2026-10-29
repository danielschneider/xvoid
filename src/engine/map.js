// Compatibility facade: map logic now lives in src/rules/{grid,movement,sight,combat}.
export { FOG_REVEAL_RANGE, VISION_RANGE } from '../rules/constants.ts';
export { BLOCKING_TERRAIN, cellHeight, cellKey, isPassable } from '../rules/grid/cells.ts';
export { createBattlefield, GRID_SIZES, MAX_BUILDING_LEVEL } from '../rules/grid/generate.ts';
export { getReachable } from '../rules/movement/pathfinding.ts';
export { hasLineOfSight } from '../rules/sight/line.ts';
export { getVisibleCells } from '../rules/sight/fog.ts';
export { getCoverAgainst, getCoverProfile, getSideCover } from '../rules/combat/cover.ts';
