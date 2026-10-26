import { getNextReadyUnit } from './readyUnit.js';
import { refreshAlerts } from '../ai/alerts.js';
import { addLog } from '../log.js';
import { AP_ACTION_COST, AP_PER_TURN } from '../constants.js';

// Hands selection to the next ready unit only once the selected unit is spent.
export function selectNextReadyPlayer(state) {
  if (state.phase !== 'player') return state;
  const current = state.units.find((unit) => unit.id === state.selectedId);
  if (!current || current.team !== 'player' || current.ap > 0) return state;
  const next = getNextReadyUnit(state);
  return next ? { ...state, selectedId: next.id, targetId: null, moveMode: true, shootMode: false } : state;
}

export function useAbility(state) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.ap < AP_ACTION_COST || unit.team !== 'player') return state;
  return {
    ...state,
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, ap: entry.ap - AP_ACTION_COST, status: 'overwatch' }
      : entry),
    logs: addLog(state, `${unit.name}: Overwatch.`, 'system'),
  };
}

export function endTurn(stateIn) {
  if (stateIn.phase !== 'player' || stateIn.movement) return stateIn;
  const state = refreshAlerts(stateIn);
  const enemyTurnOrder = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).map((unit) => unit.id);
  return {
    ...state,
    phase: 'enemy',
    enemyTurnOrder,
    enemyTurnIndex: 0,
    targetId: null,
    lastShot: null,
    logs: addLog(state, 'Feindzug beginnt.', 'combat'),
  };
}

export function finishEnemyTurn(state) {
  if (state.phase !== 'enemy' || state.enemyTurnIndex < state.enemyTurnOrder.length) return state;
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const units = state.units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? AP_PER_TURN : 0, status: null }));
  // Every new round starts with the first living player unit in roster order.
  const selectedId = players[0]?.id || null;
  const turn = state.turn + 1;
  return {
    ...state,
    units,
    turn,
    phase: 'player',
    selectedId,
    targetId: null,
    // Every new round starts the selected player unit in movement mode.
    moveMode: true,
    shootMode: false,
    enemyTurnOrder: [],
    enemyTurnIndex: 0,
    logs: addLog(state, `Runde ${turn}: Zug deiner Einheit.`, 'system'),
  };
}
