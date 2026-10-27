import test from 'node:test';
import assert from 'node:assert/strict';
import { CRIT_DURATION, FIRE_DURATION, MUZZLE_DURATION, critFrame, fallPose, fallStep, muzzleFrame, recoilAt } from './effectTiming.js';

test('critFrame at t = 0 is hidden-start: opacity 0 pop, scale 1.525', () => {
  const frame = critFrame(0);
  assert.equal(frame.visible, true);
  assert.equal(frame.opacity, 0);
  assert.equal(frame.scale, 1 + 0.35 * 1.5);
});

test('critFrame at t = 0.6 is fully opaque with scale 1', () => {
  const frame = critFrame(0.6 * CRIT_DURATION);
  assert.equal(frame.visible, true);
  assert.ok(Math.abs(frame.opacity - 1) < 1e-12);
  assert.ok(Math.abs(frame.scale - 1) < 1e-12);
});

test('critFrame at t = 1 is hidden with zero opacity', () => {
  const frame = critFrame(CRIT_DURATION);
  assert.equal(frame.visible, false);
  assert.equal(frame.opacity, 0);
  assert.equal(frame.scale, 1);
});

test('critFrame beyond t = 1 stays hidden', () => {
  const frame = critFrame(CRIT_DURATION * 2);
  assert.equal(frame.visible, false);
  assert.equal(frame.opacity, 0);
  assert.equal(frame.scale, 1);
});

test('recoilAt is 0 at rest, peaks mid-envelope, and is 0 from FIRE_DURATION on', () => {
  assert.equal(recoilAt(0), 0);
  assert.ok(recoilAt(FIRE_DURATION / 2) > recoilAt(FIRE_DURATION / 10));
  assert.equal(recoilAt(FIRE_DURATION), 0);
  assert.equal(recoilAt(Infinity), 0);
});

test('muzzleFrame at t = 0 is full flash, at MUZZLE_DURATION it is hidden', () => {
  const start = muzzleFrame(0);
  assert.deepEqual(start, { visible: true, scale: 1.2, opacity: 1 });
  const end = muzzleFrame(MUZZLE_DURATION);
  assert.equal(end.visible, false);
  assert.equal(end.opacity, 0);
  assert.equal(end.scale, 0.6);
  assert.equal(muzzleFrame(MUZZLE_DURATION * 3).visible, false);
});

test('fallStep stays 0 while alive and rises to 1 when dead, clamped', () => {
  assert.equal(fallStep(0, false, 0.1), 0);
  assert.equal(fallStep(0.5, false, 0.1), 0);
  assert.ok(Math.abs(fallStep(0, true, 0.2) - 0.5) < 1e-12);
  assert.equal(fallStep(0.9, true, 10), 1);
});

test('fallPose maps 0 -> 0, 0.5 -> 0.5, 1 -> 1 (smoothstep)', () => {
  assert.equal(fallPose(0), 0);
  assert.equal(fallPose(0.5), 0.5);
  assert.equal(fallPose(1), 1);
});
