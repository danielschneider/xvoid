import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFastFactor, scaledScheduler } from './fastScheduler.js';

test('parseFastFactor reads numeric, "x" and bare fast values', () => {
  assert.equal(parseFastFactor(null), 1);
  assert.equal(parseFastFactor('1'), 1);
  assert.equal(parseFastFactor('0.5'), 1);
  assert.equal(parseFastFactor('4'), 4);
  assert.equal(parseFastFactor('4x'), 4);
  assert.equal(parseFastFactor('fast'), 4);
  assert.equal(parseFastFactor('nonsense'), 1);
});

test('scaledScheduler divides delays and forwards clears', () => {
  const calls = [];
  const base = {
    setTimeout: (fn, delay) => (calls.push(['timeout', delay]), 'T'),
    clearTimeout: (h) => calls.push(['clearTimeout', h]),
    setInterval: (fn, delay) => (calls.push(['interval', delay]), 'I'),
    clearInterval: (h) => calls.push(['clearInterval', h]),
  };
  const fast = scaledScheduler(base, 4);
  assert.equal(fast.setTimeout(() => {}, 1400), 'T');
  assert.equal(fast.setInterval(() => {}, 220), 'I');
  fast.clearTimeout('T');
  fast.clearInterval('I');
  assert.deepEqual(calls, [
    ['timeout', 350],
    ['interval', 55],
    ['clearTimeout', 'T'],
    ['clearInterval', 'I'],
  ]);
});

test('scaledScheduler returns the base scheduler unchanged at factor 1', () => {
  const base = { setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 2, clearInterval: () => {} };
  assert.equal(scaledScheduler(base, 1), base);
});
