import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../rules/index.ts';
import { selectEnemyCounts, selectFlankedBy, selectTargetWindow } from './hud.ts';

test('selectTargetWindow is closed without a shooter or target', () => {
  const state = createInitialState();
  const unit = state.units[0];
  assert.deepEqual(selectTargetWindow(state, unit, null), { visible: false, inRange: false });
  assert.deepEqual(selectTargetWindow(state, undefined, unit), { visible: false, inRange: false });
});

test('selectFlankedBy returns an empty list without a unit', () => {
  assert.deepEqual(selectFlankedBy(createInitialState(), null), []);
});

test('selectEnemyCounts counts alien units and eliminations', () => {
  const state = createInitialState();
  const total = state.units.filter((unit) => unit.team === 'alien').length;
  assert.deepEqual(selectEnemyCounts(state), { living: total, total, eliminated: 0 });
  const wounded = { ...state, units: state.units.map((unit) => (unit.team === 'alien' ? { ...unit, hp: 0 } : unit)) };
  assert.deepEqual(selectEnemyCounts(wounded), { living: 0, total, eliminated: total });
});
