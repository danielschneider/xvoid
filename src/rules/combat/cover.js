import { cellKey } from '../grid/cells.js';

// Cover is measured per side of a cell: the neighbour on that side on the same
// level decides it. Tier 2 = full (wall, pillar), tier 1 = half (console), 0 = open.
const SIDE_OFFSETS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export function getSideCover(map, cell) {
  return Object.fromEntries(
    Object.entries(SIDE_OFFSETS).map(([side, [dx, dz]]) => [
      side,
      map.cells[cellKey({ x: cell.x + dx, z: cell.z + dz, level: cell.level })]?.cover || 0,
    ])
  );
}

// Summary of a cell's protection, independent of who is shooting: the strongest
// side decides the tier shown to the player. Used to preview a destination.
export function getCoverProfile(map, cell) {
  const sides = getSideCover(map, cell);
  const best = Math.max(...Object.values(sides));
  return { sides, tier: best, label: best === 2 ? 'full' : best === 1 ? 'half' : 'open' };
}

// Which side(s) of `target` face `shooter`. A diagonal attacker touches two sides.
function facingSides(target, shooter) {
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
export function getCoverAgainst(map, target, shooter) {
  const sides = getSideCover(map, target);
  const facing = facingSides(target, shooter);
  if (facing.length === 0) return { cover: 0, flanked: false };
  const cover = Math.min(...facing.map((side) => sides[side]));
  const flanked = cover === 0 && Object.values(sides).some((tier) => tier > 0);
  return { cover, flanked };
}
