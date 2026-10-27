import test from 'node:test';
import assert from 'node:assert/strict';
import { angleDelta, selectSpriteView } from './spriteView.js';

test('selectSpriteView picks front near 0 and back near PI', () => {
  assert.equal(selectSpriteView(0), 'front');
  assert.equal(selectSpriteView(Math.PI / 4 - 0.01), 'front');
  assert.equal(selectSpriteView(Math.PI - 0.01), 'back');
  assert.equal(selectSpriteView(-(Math.PI - 0.01)), 'back');
});

test('selectSpriteView picks right for positive side and left for negative side', () => {
  assert.equal(selectSpriteView(Math.PI / 2), 'right');
  assert.equal(selectSpriteView(-Math.PI / 2), 'left');
});

test('selectSpriteView boundaries: PI/4 and 3PI/4 belong to the side views', () => {
  assert.equal(selectSpriteView(Math.PI / 4), 'right');
  assert.equal(selectSpriteView(-Math.PI / 4), 'left');
  assert.equal(selectSpriteView((Math.PI * 3) / 4), 'right');
  assert.equal(selectSpriteView((-Math.PI * 3) / 4), 'left');
});

test('angleDelta wraps differences into (-PI, PI]', () => {
  assert.ok(Math.abs(angleDelta(0)) < 1e-12);
  assert.ok(Math.abs(angleDelta(2 * Math.PI)) < 1e-12);
  assert.ok(Math.abs(angleDelta(Math.PI / 2) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(angleDelta((3 * Math.PI) / 2) + Math.PI / 2) < 1e-12);
});
