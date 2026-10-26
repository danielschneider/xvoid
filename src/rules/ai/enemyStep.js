import { cellKey } from '../grid/cells.js';
import { getReachable } from '../movement/pathfinding.js';
import { moveEnemy } from '../movement/moveUnit.js';
import { getVisibleCells } from '../sight/fog.js';
import { hasLineOfSight } from '../sight/line.js';
import { computeCoverFor } from '../combat/hitChance.js';
import { fireAt } from '../combat/resolveShot.js';
import { addLog } from '../log.js';
import { refreshAlerts } from './alerts.js';
import { wanderEnemy } from './wander.js';
import { AP_ACTION_COST, ENEMY_MOVE_STEPS, ENEMY_SHOT_RANGE, SCOUT_RETREAT_RANGE } from '../constants.js';

export function enemyStep(stateIn) {
  const state = refreshAlerts(stateIn);
  if (state.phase !== 'enemy' || state.enemyTurnIndex >= state.enemyTurnOrder.length) return state;
  const enemy = state.units.find((unit) => unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0);
  if (!enemy) return { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 };

  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const target = [...players].sort((a, b) => (
    Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z)
  ))[0];
  if (!target) return { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 };

  if (!state.alertedGroups.includes(enemy.groupId)) return wanderEnemy(state, enemy);

  const distance = Math.hypot(target.x - enemy.x, target.z - enemy.z);
  const visibleCells = getVisibleCells(state.map, players);
  const revealedTargets = visibleCells.has(cellKey(enemy))
    ? players.filter((unit) => Math.hypot(unit.x - enemy.x, unit.z - enemy.z) <= ENEMY_SHOT_RANGE && hasLineOfSight(state.map, enemy, unit))
      .sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z))
    : [];
  const role = enemy.aiRole || enemy.role || 'raider';
  const retreating = role === 'scout' && enemy.hp <= Math.ceil(enemy.maxHp / 2) && distance <= SCOUT_RETREAT_RANGE;

  if (!retreating && enemy.ap > 0 && revealedTargets.length > 0) {
    const targetToShoot = role === 'raider'
      ? [...revealedTargets].sort((a, b) => {
        const coverA = computeCoverFor(state, enemy, a).cover;
        const coverB = computeCoverFor(state, enemy, b).cover;
        return (Math.hypot(a.x - enemy.x, a.z - enemy.z) + coverA * 2)
          - (Math.hypot(b.x - enemy.x, b.z - enemy.z) + coverB * 2);
      })[0]
      : revealedTargets[0];
    const shot = fireAt(state, targetToShoot.id, enemy.id, true);
    return { ...shot, enemyTurnIndex: state.enemyTurnIndex + 1 };
  }

  const blocked = new Set(state.units.filter((unit) => unit.id !== enemy.id && unit.hp > 0).map(cellKey));
  const maxSteps = ENEMY_MOVE_STEPS[role] ?? ENEMY_MOVE_STEPS.raider;
  const paths = getReachable(state.map, enemy, blocked, maxSteps);
  let destinations = [...paths.entries()]
    .map(([key, path]) => ({ cell: state.map.cells[key], ...path }))
    .filter(({ cell }) => {
      const nextDistance = Math.hypot(target.x - cell.x, target.z - cell.z);
      return retreating ? nextDistance > distance : nextDistance < distance;
    });

  if (role === 'guard' && !retreating) {
    const postDistance = Math.hypot(enemy.x - enemy.postX, enemy.z - enemy.postZ);
    if (postDistance <= 1) destinations = [];
    else destinations = destinations.filter(({ cell }) => (
      Math.hypot(cell.x - enemy.postX, cell.z - enemy.postZ) < postDistance
    ));
  }

  if (role === 'stalker' || retreating) {
    const concealed = destinations.filter(({ cell }) => !visibleCells.has(cellKey(cell)));
    if (concealed.length > 0) destinations = concealed;
  }

  destinations.sort((a, b) => {
    const distanceA = Math.hypot(target.x - a.cell.x, target.z - a.cell.z);
    const distanceB = Math.hypot(target.x - b.cell.x, target.z - b.cell.z);
    if (retreating) return distanceB - distanceA || b.steps - a.steps;
    if (role === 'guard') {
      return Math.hypot(a.cell.x - enemy.postX, a.cell.z - enemy.postZ)
        - Math.hypot(b.cell.x - enemy.postX, b.cell.z - enemy.postZ);
    }
    return distanceA - distanceB || b.steps - a.steps;
  });
  const destination = destinations[0];

  if (!destination || enemy.ap < AP_ACTION_COST) {
    const decision = role === 'guard' ? 'hält den Posten' : role === 'stalker' ? 'bleibt verborgen' : 'hält die Position';
    return {
      ...state,
      enemyTurnIndex: state.enemyTurnIndex + 1,
      logs: addLog(state, `${enemy.name} ${decision}.`, 'combat'),
    };
  }
  return moveEnemy(
    state,
    enemy,
    destination,
    `${enemy.name} ${retreating ? 'zieht sich zurück' : role === 'guard' ? 'kehrt zum Posten zurück' : 'rückt vor'}.`,
  );
}
