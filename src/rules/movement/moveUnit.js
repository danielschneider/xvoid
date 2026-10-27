import { cellKey } from '../grid/cells.js';
import { getReachable } from './pathfinding.js';
import { AP_ACTION_COST, DEFAULT_MOVE_RANGE } from '../constants.js';
import { addLog } from '../log.js';
import { facingToward } from '../geometry.js';
import { moveEvent } from '../../presentation/events.js';

// Step limits for a unit's move. With 1 AP left only the cheap (1 AP) half is reachable.
export function movementLimits(unit) {
  const moveRange = unit.moveRange ?? DEFAULT_MOVE_RANGE;
  const cheapSteps = Math.ceil(moveRange / 2);
  return { maxSteps: unit.ap === 1 ? cheapSteps : moveRange, cheapSteps };
}

// Returns { state, events }. Never mutates `state`.
export function moveUnit(state, destination) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.team !== 'player' || unit.ap < AP_ACTION_COST) return { state, events: [] };
  const occupied = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const { maxSteps, cheapSteps } = movementLimits(unit);
  const pathData = getReachable(state.map, unit, occupied, maxSteps, cheapSteps).get(cellKey(destination));
  if (!pathData || pathData.apCost > unit.ap) return { state, events: [] };
  const last = pathData.path[pathData.path.length - 1];
  const previous = pathData.path.length > 1 ? pathData.path[pathData.path.length - 2] : unit;
  const facing = facingToward(previous, last);
  const next = {
    ...state,
    movement: { id: state.nextId, unitId: unit.id, path: [unit, ...pathData.path], step: 0 },
    nextId: state.nextId + 1,
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, x: last.x, z: last.z, level: last.level, ap: entry.ap - pathData.apCost, facing, status: null }
      : entry),
    targetId: null,
    logs: addLog(state, `${unit.name} rückt ${pathData.steps} Felder vor.`, 'move'),
  };
  return { state: next, events: [moveEvent({ unitId: unit.id, steps: pathData.steps, enemy: false })] };
}

// Returns { state, events }. Never mutates `state`.
export function moveEnemy(state, enemy, destination, logText) {
  const last = destination.path[destination.path.length - 1];
  const previous = destination.path.length > 1 ? destination.path[destination.path.length - 2] : enemy;
  const facing = facingToward(previous, last);
  const next = {
    ...state,
    movement: { id: state.nextId, unitId: enemy.id, path: [enemy, ...destination.path], step: 0 },
    nextId: state.nextId + 1,
    units: state.units.map((unit) => unit.id === enemy.id
      ? { ...unit, x: last.x, z: last.z, level: last.level, ap: unit.ap - AP_ACTION_COST, facing }
      : unit),
    enemyTurnIndex: state.enemyTurnIndex + 1,
    logs: addLog(state, logText, 'move'),
  };
  return { state: next, events: [moveEvent({ unitId: enemy.id, steps: destination.steps, enemy: true })] };
}
