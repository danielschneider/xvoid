import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../engine/game.ts';
import { MAX_CHECKPOINTS, deserializeGame, serializeGame } from './save.ts';

test('serialize then deserialize restores the live state and checkpoints', () => {
  const first = createInitialState(12345);
  const second = { ...first, turn: 2 };
  const restored = deserializeGame(serializeGame({ current: second, checkpoints: [first, second] }));
  assert.deepEqual(restored.current, second);
  assert.deepEqual(restored.checkpoints, [first, second]);
});

test('map is stored once and reattached to every checkpoint', () => {
  const state = createInitialState(777);
  const text = serializeGame({ current: state, checkpoints: [state, state] });
  assert.equal(text.split('"cells"').length - 1, 1);
  const restored = deserializeGame(text);
  assert.equal(restored.checkpoints[0].map, restored.current.map);
});

test('corrupt, foreign or incomplete saves are rejected', () => {
  assert.equal(deserializeGame('not json'), null);
  assert.equal(deserializeGame('null'), null);
  const state = createInitialState(1);
  const wrongVersion = JSON.parse(serializeGame({ current: state, checkpoints: [state] }));
  wrongVersion.version = 99;
  assert.equal(deserializeGame(JSON.stringify(wrongVersion)), null);
  const noUnits = JSON.parse(serializeGame({ current: state, checkpoints: [state] }));
  noUnits.current.units = undefined;
  assert.equal(deserializeGame(JSON.stringify(noUnits)), null);
});

test('more checkpoints than the rewind limit are rejected', () => {
  const state = createInitialState(2);
  const many = Array.from({ length: MAX_CHECKPOINTS + 1 }, () => state);
  assert.equal(deserializeGame(serializeGame({ current: state, checkpoints: many })), null);
});
