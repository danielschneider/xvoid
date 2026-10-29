import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMING } from './timing.ts';

// Pins the values that were inline in App.jsx before refa5f.
test('timing table keeps the original delays', () => {
  assert.deepEqual(TIMING, {
    shotHoldMs: 1000,
    enemyShotHoldMs: 1300,
    enemyStepMs: 1400,
    hiddenStepMs: 0,
    moveStepMs: 220,
    moveSettleMs: 80,
  });
});
