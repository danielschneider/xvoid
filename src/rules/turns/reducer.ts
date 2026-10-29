import type { GameState, Position, StepResult } from '../types.ts';
import { moveUnit } from '../movement/moveUnit.ts';
import { fireAt, resolveOverwatch } from '../combat/resolveShot.ts';
import { refreshAlerts } from '../ai/alerts.ts';
import { enemyStep } from '../ai/enemyStep.ts';
import { createInitialState } from '../spawn/initialState.ts';
import { facingToward } from '../geometry.ts';
import { endTurn, finishEnemyTurn, selectNextReadyPlayer, useAbility } from './actions.ts';
import { appendEvents } from '../../presentation/events.ts';
import { appendLogs } from '../../presentation/logText.ts';
import { EVENT_LOG_LIMIT } from '../constants.ts';

// Every action the reducer accepts. Discriminated on `type`.
export type GameAction =
  | { type: 'attack'; id: string }
  | { type: 'move'; destination: Position }
  | { type: 'end-turn' }
  | { type: 'finish-enemy-turn' }
  | { type: 'complete-movement'; id: number }
  | { type: 'enemy-step' }
  | { type: 'ability'; name: string }
  | { type: 'select'; id: string }
  | { type: 'target'; id: string }
  | { type: 'toggle-move-mode' }
  | { type: 'move-mode' }
  | { type: 'advance-movement'; id: number }
  | { type: 'regenerate'; seed: number }
  | { type: 'restore-state'; state: GameState }
  | { type: 'toggle-levels' }
  | { type: 'clear-shot' }
  | { type: 'finish-shot'; id: number };

// Pure state transition. Returns { state, events }; events are plain objects (see presentation/events.js).
// Actions that resolve shots or enemy steps return their events; everything else returns none.
function reduce(state: GameState, action: GameAction): StepResult {
  switch (action.type) {
    case 'attack': {
      if (state.phase !== 'player' || state.movement) return { state, events: [] };
      // Selection moves on only after the shot has been shown (see finish-shot).
      const shot = fireAt(state, action.id);
      const alerts = refreshAlerts(shot.state);
      // A killed target leaves nothing to shoot at, so the selected unit returns to move mode.
      const killed = shot.events.some((event) => event.type === 'death');
      return {
        state: { ...alerts.state, shootMode: false, ...(killed ? { moveMode: true, targetId: null } : {}) },
        events: [...shot.events, ...alerts.events],
      };
    }
    case 'move': {
      if (state.phase !== 'player' || state.movement) return { state, events: [] };
      const moved = moveUnit(state, action.destination);
      const alerts = refreshAlerts(moved.state);
      return { state: selectNextReadyPlayer(alerts.state), events: [...moved.events, ...alerts.events] };
    }
    case 'end-turn':
      return endTurn(state);
    case 'finish-enemy-turn':
      return finishEnemyTurn(state);
    case 'complete-movement': {
      if (!state.movement || state.movement.id !== action.id) return { state, events: [] };
      const mover = state.units.find((unit) => unit.id === state.movement?.unitId);
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
    case 'ability':
      if (state.phase !== 'player' || state.movement) return { state, events: [] };
      return ability(state);
    default:
      return { state: applyAction(state, action), events: [] };
  }
}

// Overwatch ends the unit's turn. Selection moves on if another player unit has AP;
// when no player unit has AP left, the player round ends (end-turn events are returned too).
function ability(state: GameState): StepResult {
  const used = useAbility(state);
  if (used.events.length === 0) return used;
  const handed = selectNextReadyPlayer(used.state);
  const anyReady = handed.units.some((unit) => unit.team === 'player' && unit.hp > 0 && unit.ap > 0);
  if (anyReady) return { state: handed, events: used.events };
  const ended = endTurn(handed);
  return { state: ended.state, events: [...used.events, ...ended.events] };
}

// The only public mutation entry point for game state. Helpers never mutate.
export function gameReducer(state: GameState, action: GameAction): GameState {
  const { state: next, events } = reduce(state, action);
  if (events.length === 0) return next;
  return {
    ...next,
    logs: appendLogs(next.logs, events),
    eventLog: appendEvents(next.eventLog, events, EVENT_LOG_LIMIT),
  };
}

function applyAction(state: GameState, action: GameAction): GameState {
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
        units: state.units.map((unit) =>
          unit.id === state.selectedId
            ? { ...unit, facing: facingToward(unit, state.units.find((target) => target.id === action.id) || unit) }
            : unit
        ),
      };
    case 'toggle-move-mode':
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: !state.moveMode, shootMode: false, targetId: null };
    case 'move-mode':
      // Tapping a non-target leaves shoot mode and returns to move mode.
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: true, shootMode: false, targetId: null };
    case 'advance-movement':
      if (!state.movement || state.movement.id !== action.id) return state;
      if (state.movement.step >= state.movement.path.length - 1) return state;
      return { ...state, movement: { ...state.movement, step: state.movement.step + 1 } };
    case 'regenerate':
      return createInitialState(action.seed, state.generation + 1);
    case 'restore-state':
      // Used by round undo: the snapshot is a full round-start state taken earlier.
      return action.state;
    case 'toggle-levels':
      return { ...state, showUpper: !state.showUpper };
    case 'clear-shot':
      return { ...state, lastShot: null };
    case 'finish-shot': {
      // Runs after the shot/death animation: clear the shot and hand over to the next ready player unit.
      if (!state.lastShot || state.lastShot.id !== action.id) return state;
      const cleared = { ...state, lastShot: null };
      if (state.lastShot.enemyShot) return cleared;
      // A shooter with AP left stays selected: keep the target marking and return to fire mode.
      const shooter = cleared.units.find((unit) => unit.id === cleared.selectedId);
      const target = cleared.units.find((unit) => unit.id === cleared.targetId);
      const canFireAgain =
        shooter?.team === 'player' &&
        shooter.hp > 0 &&
        shooter.ap > 0 &&
        target &&
        target.team !== 'player' &&
        target.hp > 0;
      if (canFireAgain) return { ...cleared, shootMode: true, moveMode: false };
      // Otherwise the target marking is dropped so no crosshair lingers through the rest of the player round.
      return selectNextReadyPlayer({ ...cleared, targetId: null, shootMode: false });
    }
    default:
      return state;
  }
}
