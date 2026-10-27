import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.js';
import { cellKey, getVisibleCells, hasLineOfSight } from '../../engine/map.js';
import { adjacentWalkableCell } from '../../../test/fixtures.js';

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

test('player vision reveals nearby enemies but leaves distant enemies in fog', () => {
  const state = createInitialState(42);
  const enemy = state.units[3];
  const visible = getVisibleCells(state.map, state.units);
  assert.ok(visible.has(cellKey(state.units[0])));
  assert.ok(!visible.has(cellKey(enemy)));

  const nearbyCell = adjacentWalkableCell(state.map, state.units[0]);
  assert.ok(nearbyCell);
  const revealedEnemy = { ...enemy, x: nearbyCell.x, z: nearbyCell.z, level: nearbyCell.level };
  const revealedState = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? revealedEnemy : unit) };
  assert.ok(getVisibleCells(revealedState.map, revealedState.units).has(cellKey(revealedEnemy)));
});
