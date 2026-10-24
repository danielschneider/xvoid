import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from './game.js';
import { cellKey, getReachable, getVisibleCells, hasLineOfSight } from './map.js';

test('creates a seeded 32x32 battlefield with traversable upper levels', () => {
  const state = createInitialState(42);
  assert.equal(state.map.size, 32);
  assert.equal(state.map.seed, 42);
  assert.ok(state.map.cells[cellKey({ x: 6, z: 5, level: 1 })]);
  const paths = getReachable(state.map, { x: 6, z: 5, level: 0 });
  assert.ok(paths.has(cellKey({ x: 6, z: 5, level: 1 })));
});

test('movement follows reachable cells and spends one AP nearby', () => {
  const state = createInitialState(42);
  const moved = gameReducer(state, { type: 'move', destination: { x: 4, z: 5, level: 0 } });
  assert.deepEqual([moved.units[0].x, moved.units[0].z, moved.units[0].ap], [4, 5, 1]);
});

test('movement route follows walkable cells around walls', () => {
  const state = createInitialState(42);
  const destination = { x: 7, z: 5, level: 0 };
  const moved = gameReducer(state, { type: 'move', destination });
  assert.equal(moved.units[0].x, destination.x);
  assert.ok(moved.movement.path.length > Math.abs(destination.x - state.units[0].x) + 1);
  assert.ok(moved.movement.path.slice(1).every((cell) => cell.walkable));
});

test('selects the next living player with AP when the current player runs out', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.id === 'vanguard' ? { ...unit, ap: 1 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.units[0].ap, 0);
  assert.equal(next.selectedId, 'spectre');
});

test('keeps the current player selected when no player has AP left', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.team === 'player' ? { ...unit, ap: 0 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.selectedId, 'vanguard');
});

test('walls block line of sight without consuming an attack point', () => {
  const state = createInitialState(42);
  const shooter = state.units[0];
  const target = { ...state.units[3], x: 6, z: 5 };
  const encounter = { ...state, units: state.units.map((unit) => unit.id === target.id ? target : unit) };
  assert.equal(hasLineOfSight(encounter.map, shooter, target), false);
  const result = gameReducer(encounter, { type: 'attack', id: target.id });
  assert.equal(result.units[0].ap, shooter.ap);
  assert.equal(result.lastShot, null);
  assert.match(result.logs[0].text, /blockiert/);
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

test('enemies advance toward the nearest player during their turn', () => {
  const state = createInitialState(42);
  const enemy = state.units[3];
  const target = state.units[0];
  const distanceBefore = Math.hypot(enemy.x - target.x, enemy.z - target.z);
  const enemyTurn = gameReducer(state, { type: 'end-turn' });
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const movedEnemy = afterAction.units.find((unit) => unit.id === enemy.id);
  const distanceAfter = Math.hypot(movedEnemy.x - target.x, movedEnemy.z - target.z);
  assert.equal(afterAction.lastShot, null);
  assert.ok(distanceAfter < distanceBefore);
});

test('player vision reveals nearby enemies but leaves distant enemies in fog', () => {
  const state = createInitialState(42);
  const enemy = state.units[3];
  const visible = getVisibleCells(state.map, state.units);
  assert.ok(visible.has(cellKey(state.units[0])));
  assert.ok(!visible.has(cellKey(enemy)));

  const revealedEnemy = { ...enemy, x: 3, z: 6 };
  const revealedState = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? revealedEnemy : unit) };
  assert.ok(getVisibleCells(revealedState.map, revealedState.units).has(cellKey(revealedEnemy)));
});

test('a revealed enemy can fire at a player in line of sight', () => {
  const state = createInitialState(42);
  const enemy = { ...state.units[3], x: 3, z: 6 };
  const encounter = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? enemy : unit) };
  const enemyTurn = gameReducer(encounter, { type: 'end-turn' });
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  assert.equal(afterAction.lastShot?.enemyShot, true);
});