import type { Cell, Enemy, GameState, Position, StepResult, Unit } from '../types.ts';
import { cellKey, occupiedKeys } from '../grid/cells.ts';
import { getReachable, type ReachablePath } from '../movement/pathfinding.ts';
import { moveEnemy } from '../movement/moveUnit.ts';
import { getVisibleCells } from '../sight/fog.ts';
import { hasLineOfSight } from '../sight/line.ts';
import { computeCoverFor } from '../combat/hitChance.ts';
import { fireAt } from '../combat/resolveShot.ts';
import { refreshAlerts } from './alerts.ts';
import { wanderEnemy } from './wander.ts';
import { chooseCoverDestination } from './takeCover.ts';
import { getRole, type Role } from './roles.ts';
import { rearDistance } from './rearApproach.ts';
import { AP_ACTION_COST, ENEMY_SHOT_RANGE } from '../constants.ts';
import { enemyTurnEndEvent, holdEvent } from '../../presentation/events.ts';
import { isEnemy } from '../types.ts';

// A reachable destination: the cell plus the path data from getReachable.
type Destination = ReachablePath & { cell: Cell };

const dist = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.z - b.z);
const postOf = (enemy: Enemy): Position => ({ x: enemy.postX, z: enemy.postZ, level: 0 });
const none = (state: GameState): StepResult => ({ state, events: [] });

// Picks the shot target from revealed players (already sorted nearest first).
function chooseShotTarget(state: GameState, enemy: Enemy, revealed: Unit[], role: Role): Unit {
  if (role.targetChoice !== 'exposed') return revealed[0];
  const score = (unit: Unit) => dist(unit, enemy) + computeCoverFor(state, enemy, unit).cover * 2;
  return [...revealed].sort((a, b) => score(a) - score(b))[0];
}

// Orders candidate destinations; the first entry is the one chosen.
function sortDestinations(
  destinations: Destination[],
  target: Position,
  enemy: Enemy,
  role: Role,
  retreating: boolean
): Destination[] {
  const toTarget = (cell: Position) => dist(target, cell);
  if (retreating) return [...destinations].sort((a, b) => toTarget(b.cell) - toTarget(a.cell) || b.steps - a.steps);
  if (role.movePreference === 'post') {
    return [...destinations].sort((a, b) => dist(a.cell, postOf(enemy)) - dist(b.cell, postOf(enemy)));
  }
  if (role.movePreference === 'flank') {
    return [...destinations].sort(
      (a, b) => rearDistance(target, a.cell) - rearDistance(target, b.cell) || a.steps - b.steps
    );
  }
  return [...destinations].sort((a, b) => toTarget(a.cell) - toTarget(b.cell) || b.steps - a.steps);
}

// Filters destinations by role movement preference. Returns the candidates in order.
function chooseDestinations(
  state: GameState,
  enemy: Enemy,
  target: Position,
  role: Role,
  retreating: boolean,
  visibleCells: Set<string>
): Destination[] {
  const distance = dist(target, enemy);
  const blocked = occupiedKeys(state.units, enemy.id);
  const paths = getReachable(state.map, enemy, blocked, role.maxSteps);
  let destinations: Destination[] = [...paths.entries()].map(([key, path]) => ({
    cell: state.map.cells[key],
    ...path,
  }));
  if (role.movePreference === 'flank' && !retreating) {
    // Flankers may move sideways or away to reach the rear arc, but never close in from the front.
    destinations = destinations.filter(({ cell }) => rearDistance(target, cell) < rearDistance(target, enemy));
  } else {
    destinations = destinations.filter(({ cell }) => {
      const nextDistance = dist(target, cell);
      return retreating ? nextDistance > distance : nextDistance < distance;
    });
  }

  if (role.movePreference === 'post' && !retreating) {
    const postDistance = dist(postOf(enemy), enemy);
    destinations = postDistance <= 1 ? [] : destinations.filter(({ cell }) => dist(cell, postOf(enemy)) < postDistance);
  }

  if (role.movePreference === 'conceal' || role.movePreference === 'flank' || retreating) {
    const concealed = destinations.filter(({ cell }) => !visibleCells.has(cellKey(cell)));
    if (concealed.length > 0) destinations = concealed;
  }

  return sortDestinations(destinations, target, enemy, role, retreating);
}

// Returns { state, events } for one enemy's turn: alert events from refreshAlerts first,
// then the events of the step itself, then enemy-turn-end when a living enemy's turn was used up.
// Never mutates `stateIn`.
export function enemyStep(stateIn: GameState): StepResult {
  const alerts = refreshAlerts(stateIn);
  const enemyId = alerts.state.enemyTurnOrder[alerts.state.enemyTurnIndex];
  const enemy = alerts.state.units.find((unit): unit is Enemy => isEnemy(unit) && unit.id === enemyId && unit.hp > 0);
  const step = takeEnemyTurn(alerts.state);
  const ended =
    enemy && step.state.enemyTurnIndex > alerts.state.enemyTurnIndex ? [enemyTurnEndEvent({ enemyId: enemy.id })] : [];
  return { state: step.state, events: [...alerts.events, ...step.events, ...ended] };
}

function takeEnemyTurn(state: GameState): StepResult {
  if (state.phase !== 'enemy' || state.enemyTurnIndex >= state.enemyTurnOrder.length) return none(state);
  const enemy = state.units.find(
    (unit): unit is Enemy => isEnemy(unit) && unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0
  );
  if (!enemy) return none({ ...state, enemyTurnIndex: state.enemyTurnIndex + 1 });
  const role = getRole(enemy);

  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const target = [...players].sort((a, b) => dist(a, enemy) - dist(b, enemy))[0];
  if (!target) return none({ ...state, enemyTurnIndex: state.enemyTurnIndex + 1 });

  if (!state.alertedGroups.includes(enemy.groupId)) return wanderEnemy(state, enemy);

  const distance = dist(target, enemy);
  const visibleCells = getVisibleCells(state.map, players);
  const revealedTargets = visibleCells.has(cellKey(enemy))
    ? players
        .filter((unit) => dist(unit, enemy) <= ENEMY_SHOT_RANGE && hasLineOfSight(state.map, enemy, unit))
        .sort((a, b) => dist(a, enemy) - dist(b, enemy))
    : [];
  const retreating = role.retreat !== null && enemy.hp <= Math.ceil(enemy.maxHp / 2) && distance <= role.retreat.range;

  // Only enemies that players can actually see seek cover; hidden enemies keep their own movement rules.
  if (!retreating && role.seeksCover && enemy.ap >= AP_ACTION_COST && visibleCells.has(cellKey(enemy))) {
    const cover = chooseCoverDestination(state, enemy, role, players);
    if (cover) return moveEnemy(state, enemy, cover, 'cover');
  }

  if (!retreating && enemy.ap > 0 && revealedTargets.length > 0) {
    const targetToShoot = chooseShotTarget(state, enemy, revealedTargets, role);
    const shot = fireAt(state, targetToShoot.id, enemy.id, true);
    return { state: { ...shot.state, enemyTurnIndex: state.enemyTurnIndex + 1 }, events: shot.events };
  }

  const destination = chooseDestinations(state, enemy, target, role, retreating, visibleCells)[0];

  if (!destination || enemy.ap < AP_ACTION_COST) {
    return {
      state: { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 },
      events: [holdEvent({ unitId: enemy.id, name: enemy.name, role: enemy.aiRole })],
    };
  }
  return moveEnemy(state, enemy, destination, retreating ? 'retreat' : 'advance');
}
