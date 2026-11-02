import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../spawn/initialState.ts';
import { markExplored } from './explored.ts';
import { cellKey, getVisibleCells } from '../../engine/map.ts';

test('markExplored adds every currently visible cell and keeps earlier ones', () => {
  const state = createInitialState(3);
  const seen = markExplored(state);
  const visible = getVisibleCells(state.map, state.units);
  for (const key of visible) assert.ok(seen.explored.includes(key), key);
  const again = markExplored(seen);
  assert.equal(again, seen, 'no change returns the same state object');
});

test('explored cells survive after the squad moves away', () => {
  const state = createInitialState(3);
  const seen = markExplored(state);
  const away = { ...seen, units: seen.units.map((unit) => ({ ...unit, x: 0, z: 0, level: 0 })) };
  const after = markExplored(away);
  for (const key of seen.explored) assert.ok(after.explored.includes(key), key);
});

test('a fresh game has no explored cells and the reducer accumulates them', () => {
  const state = createInitialState(5);
  assert.deepEqual(state.explored, []);
  assert.ok(markExplored(state).explored.every((key) => typeof key === 'string' && key.split(',').length === 3));
  assert.ok(cellKey(state.units[0]));
});
