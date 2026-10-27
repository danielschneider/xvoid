import { moveUnit } from '../movement/moveUnit.js';
import { fireAt, resolveOverwatch } from '../combat/resolveShot.js';
import { refreshAlerts } from '../ai/alerts.js';
import { enemyStep } from '../ai/enemyStep.js';
import { createInitialState } from '../spawn/initialState.js';
import { facingToward } from '../geometry.js';
import { endTurn, finishEnemyTurn, selectNextReadyPlayer, useAbility } from './actions.js';
import { appendEvents } from '../../presentation/events.js';
import { EVENT_LOG_LIMIT } from '../constants.js';

// Pure state transition. Returns { state, events }; events are plain objects (see presentation/events.js).
// Actions that resolve shots or enemy steps return their events; everything else returns none.
function reduce(state, action) {
  switch (action.type) {
    case 'attack': {
      if (state.phase !== 'player' || state.movement) return { state, events: [] };
      // Selection moves on only after the shot has been shown (see finish-shot).
      const shot = fireAt(state, action.id);
      const alerts = refreshAlerts(shot.state);
      return { state: { ...alerts.state, shootMode: false }, events: [...shot.events, ...alerts.events] };
    }
    case 'move': {
      if (state.phase !== 'player' || state.movement) return { state, events: [] };
      const moved = moveUnit(state, action.destination);
      const alerts = refreshAlerts(moved.state);
      return { state: selectNextReadyPlayer(alerts.state), events: [...moved.events, ...alerts.events] };
    }
    case 'end-turn':
      return endTurn(state);
    case 'complete-movement': {
      if (state.movement?.id !== action.id) return { state, events: [] };
      const mover = state.units.find((unit) => unit.id === state.movement.unitId);
      const cleared = { ...state, movement: null };
      if (mover?.team === 'alien' && state.phase === 'enemy') {
        const alerts = refreshAlerts(cleared);
        const overwatch = resolveOverwatch(alerts.state, mover.id);
        return { state: overwatch.state, events: [...alerts.events, ...overwatch.events] };
      }
      return { state: cleared, events: [] };
    }
    case 'enemy-step':
      return enemyStep(state);
    default:
      return { state: applyAction(state, action), events: [] };
  }
}

// The only public mutation entry point for game state. Helpers never mutate.
export function gameReducer(state, action) {
  const { state: next, events } = reduce(state, action);
  if (events.length === 0) return next;
  return { ...next, eventLog: appendEvents(next.eventLog, events, EVENT_LOG_LIMIT) };
}

function applyAction(state, action) {
  switch (action.type) {
    case 'select':
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, selectedId: action.id, targetId: null, shootMode: false, moveMode: true };
    case 'target':
      if (state.phase !== 'player' || state.movement) return state;
      // Selecting an enemy leaves move mode and enters shoot mode.
      return {
        ...state,
        targetId: action.id,
        moveMode: false,
        shootMode: true,
        units: state.units.map((unit) => unit.id === state.selectedId
          ? { ...unit, facing: facingToward(unit, state.units.find((target) => target.id === action.id) || unit) }
          : unit),
      };
    case 'toggle-move-mode':
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: !state.moveMode, shootMode: false, targetId: null };
    case 'move-mode':
      // Tapping a non-target leaves shoot mode and returns to move mode.
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: true, shootMode: false, targetId: null };
    case 'ability':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(useAbility(state));
    case 'advance-movement':
      if (!state.movement || state.movement.id !== action.id) return state;
      if (state.movement.step >= state.movement.path.length - 1) return state;
      return { ...state, movement: { ...state.movement, step: state.movement.step + 1 } };
    case 'finish-enemy-turn':
      return finishEnemyTurn(state);
    case 'regenerate':
      return createInitialState(action.seed, state.generation + 1);
    case 'toggle-levels':
      return { ...state, showUpper: !state.showUpper };
    case 'clear-shot':
      return { ...state, lastShot: null };
    case 'finish-shot': {
      // Runs after the shot/death animation: clear the shot and hand over to the next ready player unit.
      if (!state.lastShot || state.lastShot.id !== action.id) return state;
      const cleared = { ...state, lastShot: null };
      return state.lastShot.enemyShot ? cleared : selectNextReadyPlayer(cleared);
    }
    default:
      return state;
  }
}
