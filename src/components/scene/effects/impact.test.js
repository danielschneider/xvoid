import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTICLE_LIFE,
  SHAKE_DURATION,
  burstVelocities,
  impactKind,
  impactSpec,
  shakeAt,
  tracerLength,
  travelDuration,
} from './impact.js';

const hit = { id: 1, hit: true, crit: false };
const crit = { id: 2, hit: true, crit: true };
const miss = { id: 3, hit: false, crit: false };

test('impactKind: miss, crit, cover and open', () => {
  assert.equal(impactKind(miss, { cover: 2 }), 'miss');
  assert.equal(impactKind(crit, { cover: 0 }), 'crit');
  assert.equal(impactKind(hit, { cover: 1 }), 'cover');
  assert.equal(impactKind(hit, { cover: 0, flanked: true }), 'open');
  assert.equal(impactKind(hit, 2), 'cover');
  assert.equal(impactKind(hit, undefined), 'open');
});

test('impactSpec: a miss has no particles or light', () => {
  const spec = impactSpec(miss, { cover: 2 });
  assert.equal(spec.kind, 'miss');
  assert.equal(spec.sparkCount, 0);
  assert.equal(spec.dustCount, 0);
  assert.equal(spec.lightIntensity, 0);
});

test('impactSpec: cover gives dust, open ground gives sparks', () => {
  const onCover = impactSpec(hit, { cover: 1 });
  const open = impactSpec(hit, { cover: 0 });
  assert.ok(onCover.dustCount > onCover.sparkCount);
  assert.ok(open.sparkCount > open.dustCount);
});

test('impactSpec: crit is the strongest burst, shake and light', () => {
  const open = impactSpec(hit, 0);
  const critSpec = impactSpec(crit, 0);
  assert.ok(critSpec.sparkCount > open.sparkCount);
  assert.ok(critSpec.dustCount > open.dustCount);
  assert.ok(critSpec.shakeStrength > open.shakeStrength);
  assert.ok(critSpec.lightIntensity > open.lightIntensity);
});

test('travelDuration: same travel time for player and enemy shots', () => {
  assert.equal(travelDuration(false), 0.3);
  assert.equal(travelDuration(true), 0.3);
});

test('tracerLength: hits stop at the target, misses run past it', () => {
  assert.equal(tracerLength(5, true), 5);
  assert.ok(tracerLength(5, false) > 5);
});

test('shakeAt: starts at full amplitude, is zero at and after duration', () => {
  const start = shakeAt(0, SHAKE_DURATION, 0.05);
  assert.ok(Math.abs(start.x) <= 0.05 + 1e-9);
  assert.ok(Math.abs(start.y) <= 0.05 + 1e-9);
  assert.ok(Math.abs(start.x) + Math.abs(start.y) > 0);
  assert.deepEqual(shakeAt(SHAKE_DURATION, SHAKE_DURATION, 0.05), { x: 0, y: 0 });
  assert.deepEqual(shakeAt(1, SHAKE_DURATION, 0.05), { x: 0, y: 0 });
  assert.deepEqual(shakeAt(0.1, 0, 0.05), { x: 0, y: 0 });
});

test('shakeAt: amplitude scales with strength and decays over time', () => {
  const early = shakeAt(0.01, SHAKE_DURATION, 0.1);
  const late = shakeAt(0.15, SHAKE_DURATION, 0.1);
  assert.ok(Math.abs(early.x) <= 0.1 && Math.abs(late.x) <= 0.1);
  assert.ok(Math.abs(late.x) <= 0.1 * (1 - 0.15 / SHAKE_DURATION) + 1e-9);
  assert.deepEqual(shakeAt(0.05, SHAKE_DURATION, 0), { x: 0, y: 0 });
});

test('burstVelocities: deterministic, correct count, upward', () => {
  const a = burstVelocities(12, 7);
  const b = burstVelocities(12, 7);
  assert.equal(a.length, 12);
  assert.deepEqual(a, b);
  assert.notDeepEqual(burstVelocities(4, 8), burstVelocities(4, 9));
  for (const v of a) assert.ok(v.y > 0);
  assert.deepEqual(burstVelocities(0, 1), []);
});

test('PARTICLE_LIFE fits inside the shot lifetime after travel', () => {
  assert.ok(travelDuration(false) + PARTICLE_LIFE <= 1.15);
  assert.ok(travelDuration(true) + PARTICLE_LIFE <= 1.15);
});
