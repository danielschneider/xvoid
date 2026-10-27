import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.js';
import { cellKey, getReachable } from '../../engine/map.js';

test('selects the next living player with AP when the current player runs out', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.id === 'vanguard' ? { ...unit, ap: 1 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.units[0].ap, 0);
  assert.equal(next.selectedId, 'spectre');
});

test('switching player resets to move mode', () => {
  const state = { ...createInitialState(42), moveMode: false, shootMode: true };
  const selected = gameReducer(state, { type: 'select', id: 'spectre' });
  assert.equal(selected.selectedId, 'spectre');
  assert.equal(selected.moveMode, true);
  assert.equal(selected.shootMode, false);
});

test('keeps the current player selected when no player has AP left', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.team === 'player' ? { ...unit, ap: 0 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.selectedId, 'vanguard');
});

test('ending the player turn refreshes AP and advances the round', () => {
  const state = createInitialState(42);
  const spent = gameReducer(state, { type: 'ability', name: 'overwatch' });
  const enemyTurn = gameReducer(spent, { type: 'end-turn' });
  assert.equal(enemyTurn.phase, 'enemy');
  assert.equal(enemyTurn.turn, 1);
  const enemyAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  assert.equal(enemyAction.enemyTurnIndex, 1);
  const finished = gameReducer({ ...enemyAction, enemyTurnIndex: enemyAction.enemyTurnOrder.length }, { type: 'finish-enemy-turn' });
  assert.equal(finished.turn, 2);
  assert.equal(finished.phase, 'player');
  assert.equal(finished.units[0].ap, 2);
});

test('each new round starts the player unit in move mode', () => {
  const state = { ...createInitialState(42), phase: 'enemy', enemyTurnOrder: [], enemyTurnIndex: 0, moveMode: false, shootMode: true, targetId: 'x' };
  const next = gameReducer(state, { type: 'finish-enemy-turn' });
  assert.equal(next.turn, 2);
  assert.equal(next.moveMode, true);
  assert.equal(next.shootMode, false);
  assert.equal(next.targetId, null);
});

test('ending the enemy turn clears all stances', () => {
  const state = createInitialState(42);
  const stanced = { ...state, phase: 'enemy', enemyTurnOrder: [], enemyTurnIndex: 0, units: state.units.map((unit) => ({ ...unit, status: 'overwatch' })) };
  const finished = gameReducer(stanced, { type: 'finish-enemy-turn' });
  assert.ok(finished.units.every((unit) => unit.status === null));
});

test('moving clears stance', () => {
  const state = createInitialState(42);
  const unit = state.units[0];
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const destination = [...getReachable(state.map, unit, blocked).values()].find((path) => path.apCost === 1)?.path.at(-1);
  assert.ok(destination);
  const stanced = { ...state, units: state.units.map((entry) => (entry.id === unit.id ? { ...entry, status: 'overwatch' } : entry)) };
  const moved = gameReducer(stanced, { type: 'move', destination });
  assert.equal(moved.units.find((entry) => entry.id === unit.id).status, null);
});
