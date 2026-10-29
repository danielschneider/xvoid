import type { Cell, Position } from '../types.ts';

export const cellKey = ({ x, z, level = 0 }: { x: number; z: number; level?: number }): string => `${x},${z},${level}`;
// Height of a cell in steps. Currently the storey index only: no generator sets an
// elevation, so this is the single place to change if terrain height is added later.
export const cellHeight = (cell: { level?: number } | null | undefined): number => cell?.level || 0;

// Terrain that physically blocks movement. Boxes (pillar/console) are rendered as
// solid cover objects, so they must never be walkable. Single source of truth for
// movement, spawning, and map-connectivity checks.
export const BLOCKING_TERRAIN = new Set(['wall', 'partition', 'rail', 'pillar', 'console']);
export const isPassable = (cell: Cell | null | undefined): boolean =>
  Boolean(cell && cell.walkable && !BLOCKING_TERRAIN.has(cell.terrain));

export const neighborsOf = (current: Position, transitions: Record<string, Position[]>): Position[] => [
  { x: current.x + 1, z: current.z, level: current.level },
  { x: current.x - 1, z: current.z, level: current.level },
  { x: current.x, z: current.z + 1, level: current.level },
  { x: current.x, z: current.z - 1, level: current.level },
  ...(transitions[cellKey(current)] || []),
];

// Keys of the cells occupied by living units, optionally skipping one unit id.
export const occupiedKeys = (
  units: { id: string; x: number; z: number; level?: number; hp: number }[],
  exceptId?: string
): Set<string> =>
  new Set(units.filter((unit) => unit.hp > 0 && unit.id !== exceptId).map((unit) => cellKey(unit)));
