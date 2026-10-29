import type { Battlefield, Cell, Enemy, GameState, Position, Unit } from '../types.ts';
import { occupiedKeys } from '../grid/cells.ts';
import { getReachable, type ReachablePath } from '../movement/pathfinding.ts';
import { getCoverAgainst } from '../combat/cover.ts';
import { hasLineOfSight } from '../sight/line.ts';
import { ENEMY_SHOT_RANGE, WANDER_RADIUS } from '../constants.ts';
import { rearDistance } from './rearApproach.ts';

const dist = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.z - b.z);

// Exposure of a cell: one point per open shot that players can take at it, half a point
// less per cover tier. Full cover (tier 2) makes a threat worth nothing; a flanked cell counts as open.
export function exposureAt(map: Battlefield, cell: Position & { level: number }, players: Unit[]): number {
  return players.reduce((total, player) => {
    if (dist(player, cell) > ENEMY_SHOT_RANGE || !hasLineOfSight(map, player, cell)) return total;
    return total + (2 - getCoverAgainst(map, cell, player).cover);
  }, 0);
}

// Cells the enemy can reach this turn. Post-holders stay inside their post radius; flankers
// never give up rear-arc position for cover.
function coverCandidates(
  state: GameState,
  enemy: Enemy,
  role: { movePreference: string; maxSteps: number },
  nearest: Unit
): (ReachablePath & { cell: Cell })[] {
  const blocked = occupiedKeys(state.units, enemy.id);
  const keepsRole = (cell: Position) => {
    if (role.movePreference === 'post') return dist(cell, { x: enemy.postX, z: enemy.postZ }) <= WANDER_RADIUS;
    if (role.movePreference === 'flank') return rearDistance(nearest, cell) <= rearDistance(nearest, enemy);
    return true;
  };
  return [...getReachable(state.map, enemy, blocked, role.maxSteps).entries()]
    .map(([key, path]) => ({ cell: state.map.cells[key], ...path }))
    .filter(({ cell }) => keepsRole(cell));
}

// Returns the reachable destination that is strictly safer than the enemy's current cell,
// preferring the least exposed and, on a tie, the shortest move. Returns null when the enemy
// is not exposed or no reachable cell offers better protection.
export function chooseCoverDestination(
  state: GameState,
  enemy: Enemy,
  role: { movePreference: string; maxSteps: number },
  players: Unit[]
): (ReachablePath & { cell: Cell; exposure: number }) | null {
  const current = exposureAt(state.map, enemy, players);
  if (current === 0) return null;
  const nearest = [...players].sort((a, b) => dist(a, enemy) - dist(b, enemy))[0];
  let best: (ReachablePath & { cell: Cell; exposure: number }) | null = null;
  for (const candidate of coverCandidates(state, enemy, role, nearest)) {
    const exposure = exposureAt(state.map, candidate.cell, players);
    if (exposure >= current) continue;
    if (!best || exposure < best.exposure || (exposure === best.exposure && candidate.steps < best.steps)) {
      best = { ...candidate, exposure };
    }
  }
  return best;
}
