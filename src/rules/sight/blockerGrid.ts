import type { Battlefield } from '../types.ts';

// Terrain that stops sight. Rails are see-through; boxes give cover instead.
export const SIGHT_BLOCKERS = new Set(['wall', 'partition']);

// Flat, integer-indexed copy of which cells block sight. Replaces string-keyed lookups
// in the hot ray loop. Built once per map; terrain only changes during generation.
export interface BlockerGrid {
  minX: number;
  minZ: number;
  minLevel: number;
  width: number;
  depth: number;
  levels: number;
  data: Uint8Array;
}

const grids = new WeakMap<Battlefield, BlockerGrid>();

function buildGrid(map: Battlefield): BlockerGrid {
  const cells = Object.values(map.cells);
  let minX = Infinity;
  let minZ = Infinity;
  let minLevel = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let maxLevel = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minZ = Math.min(minZ, cell.z);
    maxZ = Math.max(maxZ, cell.z);
    minLevel = Math.min(minLevel, cell.level);
    maxLevel = Math.max(maxLevel, cell.level);
  }
  if (cells.length === 0) {
    return { minX: 0, minZ: 0, minLevel: 0, width: 0, depth: 0, levels: 0, data: new Uint8Array(0) };
  }
  const width = maxX - minX + 1;
  const depth = maxZ - minZ + 1;
  const levels = maxLevel - minLevel + 1;
  const data = new Uint8Array(width * depth * levels);
  for (const cell of cells) {
    if (!SIGHT_BLOCKERS.has(cell.terrain)) continue;
    data[(cell.level - minLevel) * width * depth + (cell.z - minZ) * width + (cell.x - minX)] = 1;
  }
  return { minX, minZ, minLevel, width, depth, levels, data };
}

// Grid for a map, built on first use and reused afterwards.
export function getBlockerGrid(map: Battlefield): BlockerGrid {
  let grid = grids.get(map);
  if (!grid) {
    grid = buildGrid(map);
    grids.set(map, grid);
  }
  return grid;
}

// Whether the cell that (x, z, level) rounds to blocks sight. Missing cells do not block.
export function isSightBlocked(grid: BlockerGrid, x: number, z: number, level: number): boolean {
  const cx = Math.round(x) - grid.minX;
  const cz = Math.round(z) - grid.minZ;
  const cl = level - grid.minLevel;
  if (cx < 0 || cz < 0 || cl < 0 || cx >= grid.width || cz >= grid.depth || cl >= grid.levels) return false;
  return grid.data[cl * grid.width * grid.depth + cz * grid.width + cx] === 1;
}
