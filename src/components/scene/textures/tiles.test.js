import test from 'node:test';
import assert from 'node:assert/strict';
import { seededNoise } from './tiles.js';

test('seededNoise is deterministic and in [0, 1)', () => {
  for (let x = -5; x < 30; x += 1) {
    for (let z = 0; z < 30; z += 1) {
      const value = seededNoise(42, x, z, 47);
      assert.equal(value, seededNoise(42, x, z, 47));
      assert.ok(value >= 0 && value < 1, `out of range at ${x},${z}: ${value}`);
    }
  }
});

test('seededNoise depends on seed, salt and position', () => {
  assert.notEqual(seededNoise(1, 3, 4, 0), seededNoise(2, 3, 4, 0));
  assert.notEqual(seededNoise(1, 3, 4, 0), seededNoise(1, 3, 4, 47));
  assert.notEqual(seededNoise(1, 3, 4, 0), seededNoise(1, 4, 3, 0));
});
