import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from './game.js';
import { cellKey, getReachable, hasLineOfSight } from './map.js';

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
  const next = gameReducer(spent, { type: 'end-turn' });
  assert.equal(next.turn, 2);
  assert.equal(next.units[0].ap, 2);
});