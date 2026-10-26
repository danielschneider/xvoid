import { cellKey } from '../grid/cells.js';
import { getReachable } from '../movement/pathfinding.js';
import { moveEnemy } from '../movement/moveUnit.js';
import { makeRandom } from '../rng.js';
import { addLog } from '../log.js';
import { AP_ACTION_COST, WANDER_CHANCE, WANDER_RADIUS, WANDER_STEPS } from '../constants.js';

// Unalerted enemy: drifts randomly around its post without knowing where the squad is.
export function wanderEnemy(state, enemy) {
  const random = makeRandom(state.rng);
  const skip = (text) => ({
    ...state,
    rng: random.cursor,
    enemyTurnIndex: state.enemyTurnIndex + 1,
    logs: text ? addLog(state, text, 'combat') : state.logs,
  });
  if (enemy.ap < AP_ACTION_COST || random() > WANDER_CHANCE) return skip(null);
  const blocked = new Set(state.units.filter((unit) => unit.id !== enemy.id && unit.hp > 0).map(cellKey));
  const options = [...getReachable(state.map, enemy, blocked, WANDER_STEPS).values()]
    .map((path) => ({ ...path, cell: path.path[path.path.length - 1] }))
    .filter(({ cell }) => Math.hypot(cell.x - enemy.postX, cell.z - enemy.postZ) <= WANDER_RADIUS);
  if (options.length === 0) return skip(null);
  const destination = options[Math.floor(random() * options.length)];
  return moveEnemy({ ...state, rng: random.cursor }, enemy, destination, `${enemy.name} patrouilliert.`);
}
