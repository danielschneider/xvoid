import test from 'node:test';
import assert from 'node:assert/strict';
import { CELL_OFFSET, STEP_HEIGHT, toWorld, toWorldY } from './coords.js';

test('CELL_OFFSET centres a 32-cell map on the origin', () => {
  assert.equal(CELL_OFFSET, 15.5);
});

test('toWorld subtracts the offset from x and z', () => {
  assert.deepEqual(toWorld({ x: 0, z: 0, level: 0 }), { x: -15.5, z: -15.5 });
  assert.deepEqual(toWorld({ x: 15, z: 16, level: 2 }), { x: -0.5, z: 0.5 });
});

test('toWorldY is the storey index times STEP_HEIGHT', () => {
  assert.equal(STEP_HEIGHT, 1.5);
  assert.equal(toWorldY({ x: 3, z: 4, level: 0 }), 0);
  assert.equal(toWorldY({ x: 3, z: 4, level: 2 }), 3);
});

test('toWorld and toWorldY agree with the inline expressions they replaced', () => {
  for (let x = 0; x < 48; x += 1) {
    for (let z = 0; z < 48; z += 1) {
      for (let level = 0; level < 4; level += 1) {
        const cell = { x, z, level };
        assert.equal(toWorld(cell).x, x - 15.5);
        assert.equal(toWorld(cell).z, z - 15.5);
        assert.equal(toWorldY(cell), level * 1.5);
      }
    }
  }
});

test('toWorld tolerates a cell without level', () => {
  assert.equal(toWorldY({ x: 1, z: 1 }), 0);
});
