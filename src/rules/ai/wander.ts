import type { Enemy, GameState, StepResult } from '../types.ts';
import { occupiedKeys } from '../grid/cells.ts';
import { getReachable } from '../movement/pathfinding.ts';
import { moveEnemy } from '../movement/moveUnit.ts';
import { makeRandom } from '../rng.ts';
import { AP_ACTION_COST, WANDER_CHANCE, WANDER_RADIUS, WANDER_STEPS } from '../constants.ts';

// Unalerted enemy: drifts randomly around its post without knowing where the squad is.
// Returns { state, events }. Never mutates `state`.
export function wanderEnemy(state: GameState, enemy: Enemy): StepResult {
  const random = makeRandom(state.rng);
  const skip = (): StepResult => ({
    state: { ...state, rng: random.cursor, enemyTurnIndex: state.enemyTurnIndex + 1 },
    events: [],
  });
  if (enemy.ap < AP_ACTION_COST || random() > WANDER_CHANCE) return skip();
  const blocked = occupiedKeys(state.units, enemy.id);
  const options = [...getReachable(state.map, enemy, blocked, WANDER_STEPS).values()]
    .map((path) => ({ ...path, cell: path.path[path.path.length - 1] }))
    .filter(({ cell }) => Math.hypot(cell.x - enemy.postX, cell.z - enemy.postZ) <= WANDER_RADIUS);
  if (options.length === 0) return skip();
  const destination = options[Math.floor(random() * options.length)];
  return moveEnemy({ ...state, rng: random.cursor }, enemy, destination, 'patrol');
}
