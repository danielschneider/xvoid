import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOOD_COLOR,
  BLOOD_SPLAT_COUNT,
  STAIN_MAX,
  STAIN_RADIUS_MAX,
  STAIN_RADIUS_MIN,
  addStains,
  bloodSplats,
  seededUnit,
  stainsForShot,
} from './blood.js';

test('seededUnit is deterministic and within [0, 1)', () => {
  for (let i = 0; i < 50; i += 1) {
    const v = seededUnit(7, i);
    assert.ok(v >= 0 && v < 1);
    assert.equal(v, seededUnit(7, i));
  }
});

test('bloodSplats returns the same splats for the same seed, sized within bounds', () => {
  const a = bloodSplats(42);
  assert.deepEqual(a, bloodSplats(42));
  assert.equal(a.length, BLOOD_SPLAT_COUNT);
  for (const splat of a) {
    assert.ok(splat.radius >= STAIN_RADIUS_MIN && splat.radius <= STAIN_RADIUS_MAX);
    assert.ok(Math.hypot(splat.x, splat.z) <= 0.35 + 1e-9);
  }
});

test('stainsForShot places keyed stains around the cell at floor height', () => {
  const shot = { id: 9 };
  const stains = stainsForShot(shot, 2, -3, 1.5);
  assert.equal(stains.length, BLOOD_SPLAT_COUNT);
  assert.equal(new Set(stains.map((s) => s.key)).size, stains.length);
  for (const stain of stains) {
    assert.ok(stain.key.startsWith('9:'));
    assert.ok(Math.abs(stain.x - 2) <= 0.35 + 1e-9);
    assert.ok(Math.abs(stain.z + 3) <= 0.35 + 1e-9);
    assert.ok(stain.y > 1.5 && stain.y < 1.6);
  }
});

test('addStains keeps only the newest STAIN_MAX entries', () => {
  let list = [];
  for (let i = 0; i < STAIN_MAX + 10; i += 1) list = addStains(list, [{ key: `${i}:0` }]);
  assert.equal(list.length, STAIN_MAX);
  assert.equal(list[0].key, `10:0`);
  assert.equal(list[list.length - 1].key, `${STAIN_MAX + 9}:0`);
});

test('blood colour is green', () => {
  const [r, g, b] = BLOOD_COLOR;
  assert.ok(g > r && g > b);
});
