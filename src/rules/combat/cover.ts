import type { Battlefield, Cover, Position } from '../types.ts';
import { cellKey } from '../grid/cells.ts';

// Cover is measured per side of a cell: the neighbour on that side on the same
// level decides it. Tier 2 = full (wall, pillar), tier 1 = half (console), 0 = open.
type Side = 'N' | 'E' | 'S' | 'W';
const SIDE_OFFSETS: Record<Side, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

// Cover tier per side of a cell, keyed by side name.
export type SideCover = Record<Side, Cover>;

export interface CoverProfile {
  sides: SideCover;
  tier: Cover;
  label: 'full' | 'half' | 'open';
}

// Result of a shot against a target: the cover tier it gets and whether the shooter flanks it.
export interface CoverAgainst {
  cover: Cover;
  flanked: boolean;
}

export function getSideCover(map: Battlefield, cell: Position & { level: number }): SideCover {
  const tierAt = (side: Side): Cover => {
    const [dx, dz] = SIDE_OFFSETS[side];
    return map.cells[cellKey({ x: cell.x + dx, z: cell.z + dz, level: cell.level })]?.cover || 0;
  };
  return { N: tierAt('N'), E: tierAt('E'), S: tierAt('S'), W: tierAt('W') };
}

// Tiers are 0, 1 or 2, so the extremes are always a valid Cover.
const maxCover = (tiers: Cover[]): Cover => tiers.reduce<Cover>((a, b) => (b > a ? b : a), 0);
const minCover = (tiers: Cover[]): Cover => tiers.reduce<Cover>((a, b) => (b < a ? b : a), 2);

// Summary of a cell's protection, independent of who is shooting: the strongest
// side decides the tier shown to the player. Used to preview a destination.
export function getCoverProfile(map: Battlefield, cell: Position & { level: number }): CoverProfile {
  const sides = getSideCover(map, cell);
  const best = maxCover(Object.values(sides));
  return { sides, tier: best, label: best === 2 ? 'full' : best === 1 ? 'half' : 'open' };
}

// Which side(s) of `target` face `shooter`. A diagonal attacker touches two sides.
function facingSides(target: Position, shooter: Position): Side[] {
  const dx = shooter.x - target.x;
  const dz = shooter.z - target.z;
  if (dx === 0 && dz === 0) return [];
  if (Math.abs(dx) > Math.abs(dz)) return [dx > 0 ? 'E' : 'W'];
  if (Math.abs(dz) > Math.abs(dx)) return [dz > 0 ? 'S' : 'N'];
  return [dx > 0 ? 'E' : 'W', dz > 0 ? 'S' : 'N'];
}

// Cover that `target` gets against a shot from `shooter`, and whether the shooter
// flanks it: the attacking side is open while the target has cover on another side.
// Diagonal attackers get the weaker of their two sides.
export function getCoverAgainst(map: Battlefield, target: Position & { level: number }, shooter: Position): CoverAgainst {
  const sides = getSideCover(map, target);
  const facing = facingSides(target, shooter);
  if (facing.length === 0) return { cover: 0, flanked: false };
  const cover = minCover(facing.map((side) => sides[side]));
  const flanked = cover === 0 && Object.values(sides).some((tier) => tier > 0);
  return { cover, flanked };
}
