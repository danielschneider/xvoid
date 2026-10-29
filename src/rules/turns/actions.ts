import { getNextReadyUnit } from './readyUnit.ts';
import { refreshAlerts } from '../ai/alerts.ts';
import { AP_ACTION_COST, AP_PER_TURN } from '../constants.ts';
import { overwatchEvent, roundStartEvent, turnStartEvent } from '../../presentation/events.js';

// Hands selection to the next ready unit only once the selected unit is spent.
export function selectNextReadyPlayer(state) {
  if (state.phase !== 'player') return state;
  const current = state.units.find((unit) => unit.id === state.selectedId);
  if (!current || current.team !== 'player' || current.ap > 0) return state;
  const next = getNextReadyUnit(state);
  return next ? { ...state, selectedId: next.id, targetId: null, moveMode: true, shootMode: false } : state;
}

// Returns { state, events }; overwatch spends all of the unit's remaining AP and emits an overwatch event.
export function useAbility(state) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.ap < AP_ACTION_COST || unit.team !== 'player') return { state, events: [] };
  const next = {
    ...state,
    units: state.units.map((entry) => (entry.id === unit.id ? { ...entry, ap: 0, status: 'overwatch' } : entry)),
  };
  return { state: next, events: [overwatchEvent({ unitId: unit.id, name: unit.name })] };
}

// Returns { state, events }: the alerts raised by the end-of-turn check, then turn-start.
export function endTurn(stateIn) {
  if (stateIn.phase !== 'player' || stateIn.movement) return { state: stateIn, events: [] };
  const alerts = refreshAlerts(stateIn);
  const state = alerts.state;
  const enemyTurnOrder = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).map((unit) => unit.id);
  const next = {
    ...state,
    phase: 'enemy',
    enemyTurnOrder,
    enemyTurnIndex: 0,
    targetId: null,
    lastShot: null,
  };
  return { state: next, events: [...alerts.events, turnStartEvent({ turn: state.turn })] };
}

// Returns { state, events }: round-start for the new round when the enemy phase is over.
export function finishEnemyTurn(state) {
  if (state.phase !== 'enemy' || state.enemyTurnIndex < state.enemyTurnOrder.length) return { state, events: [] };
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const units = state.units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? AP_PER_TURN : 0, status: null }));
  // Every new round starts with the first living player unit in roster order.
  const selectedId = players[0]?.id || null;
  const turn = state.turn + 1;
  const next = {
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
  };
  return { state: next, events: [roundStartEvent({ turn, selectedId })] };
}
