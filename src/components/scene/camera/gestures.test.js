import test from 'node:test';
import assert from 'node:assert/strict';
import { angleDelta, clampZoom, keyPanStep, keyRotation, pinchMetrics, pinchZoom, rotationSteps, wheelZoom } from './gestures.js';

// Expected values follow the HEAD CameraRig handlers (f32310c): zoom clamp 18..72, wheel 0.92 / 1.08,
// pinch scale distance / max(1, previous), quarter turn PI/2 fired at half a step.

test('clampZoom keeps zoom in 18..72', () => {
  assert.equal(clampZoom(10), 18);
  assert.equal(clampZoom(40), 40);
  assert.equal(clampZoom(100), 72);
});

test('wheelZoom zooms out on positive deltaY and in on negative, clamped', () => {
  assert.equal(wheelZoom(50, 1), 50 * 0.92);
  assert.equal(wheelZoom(50, -1), 50 * 1.08);
  assert.equal(wheelZoom(50, 0), 50 * 1.08);
  assert.equal(wheelZoom(18, 1), 18);
  assert.equal(wheelZoom(72, -1), 72);
});

test('pinchZoom scales by distance ratio and guards a zero previous distance', () => {
  assert.equal(pinchZoom(40, 100, 150), 60);
  assert.equal(pinchZoom(40, 100, 50), 20);
  assert.equal(pinchZoom(40, 0, 10), 72);
  assert.equal(pinchZoom(40, 0.5, 0.25), 18);
  assert.equal(pinchZoom(40, 100, 105), 42);
  assert.equal(pinchZoom(70, 10, 100), 72);
});

test('pinchMetrics returns distance and angle for two pointers, null otherwise', () => {
  assert.deepEqual(pinchMetrics([{ x: 0, y: 0 }, { x: 3, y: 4 }]), { distance: 5, angle: Math.atan2(4, 3) });
  assert.equal(pinchMetrics([{ x: 0, y: 0 }]), null);
  assert.equal(pinchMetrics([]), null);
});

test('angleDelta wraps across the -PI / PI seam', () => {
  assert.equal(angleDelta(0.5, 0.25), 0.25);
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - (-0.2)) < 1e-12);
  assert.ok(Math.abs(angleDelta(-Math.PI + 0.1, Math.PI - 0.1) - 0.2) < 1e-12);
});

test('rotationSteps fires nothing below half a step', () => {
  assert.deepEqual(rotationSteps(0), { directions: [], remainder: 0 });
  assert.deepEqual(rotationSteps(Math.PI / 4 - 0.01), { directions: [], remainder: Math.PI / 4 - 0.01 });
});

// Exactly half a step (PI/4) never terminates in HEAD and here: the remainder flips sign forever.
// Not tested; see the note in the commit message.
test('rotationSteps fires one turn just past half a step and keeps the rest', () => {
  const result = rotationSteps(Math.PI / 4 + 0.01);
  assert.deepEqual(result.directions, [1]);
  assert.ok(Math.abs(result.remainder - (Math.PI / 4 + 0.01 - Math.PI / 2)) < 1e-12);
});

test('rotationSteps fires negative turns for negative accumulation', () => {
  const result = rotationSteps(-Math.PI / 4 - 0.01);
  assert.deepEqual(result.directions, [-1]);
  assert.ok(Math.abs(result.remainder - (-Math.PI / 4 - 0.01 + Math.PI / 2)) < 1e-12);
});

test('rotationSteps can fire several turns in one call and leaves a remainder under half a step', () => {
  const result = rotationSteps(Math.PI);
  assert.deepEqual(result.directions, [1, 1]);
  assert.equal(result.remainder, 0);
  const three = rotationSteps(Math.PI * 1.3);
  assert.deepEqual(three.directions, [1, 1, 1]);
  assert.ok(Math.abs(three.remainder - (Math.PI * 1.3 - Math.PI * 1.5)) < 1e-12);
  assert.ok(Math.abs(three.remainder) < Math.PI / 4);
});

test('keyRotation maps q to -1, e to +1 and other keys to null', () => {
  assert.equal(keyRotation('q'), -1);
  assert.equal(keyRotation('e'), 1);
  assert.equal(keyRotation('w'), null);
});

test('keyPanStep maps WASD and arrows to the HEAD pan directions', () => {
  assert.deepEqual(keyPanStep('w'), { dx: 0, dy: -1 });
  assert.deepEqual(keyPanStep('arrowup'), { dx: 0, dy: -1 });
  assert.deepEqual(keyPanStep('s'), { dx: 0, dy: 1 });
  assert.deepEqual(keyPanStep('arrowdown'), { dx: 0, dy: 1 });
  assert.deepEqual(keyPanStep('a'), { dx: 1, dy: 0 });
  assert.deepEqual(keyPanStep('arrowleft'), { dx: 1, dy: 0 });
  assert.deepEqual(keyPanStep('d'), { dx: -1, dy: 0 });
  assert.deepEqual(keyPanStep('arrowright'), { dx: -1, dy: 0 });
  assert.equal(keyPanStep('q'), null);
});
