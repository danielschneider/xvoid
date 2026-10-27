import test from 'node:test';
import assert from 'node:assert/strict';
import { aliveCount, burstSpawns, coneSpawns, createPool, hexColor, mulberry32, spawn, step } from './particleSim.js';

const WHITE = [1, 1, 1];

function particle(overrides = {}) {
  return { x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0, life: 1, size: 4, color: WHITE, ...overrides };
}

test('createPool allocates typed arrays of the requested capacity', () => {
  const pool = createPool(8);
  assert.equal(pool.capacity, 8);
  assert.ok(pool.positions instanceof Float32Array);
  assert.equal(pool.positions.length, 24);
  assert.equal(pool.velocities.length, 24);
  assert.equal(pool.color.length, 24);
  assert.equal(pool.life.length, 8);
  assert.equal(pool.maxLife.length, 8);
  assert.equal(pool.size.length, 8);
  assert.equal(aliveCount(pool), 0);
});

test('spawn writes fields into the first free slot and counts alive particles', () => {
  const pool = createPool(4);
  const slot = spawn(pool, particle({ vx: 5, vy: 6, vz: 7, life: 0.5, size: 9, color: [0.1, 0.2, 0.3] }));
  assert.equal(slot, 0);
  assert.equal(aliveCount(pool), 1);
  assert.deepEqual([...pool.positions.slice(0, 3)], [1, 2, 3]);
  assert.deepEqual([...pool.velocities.slice(0, 3)], [5, 6, 7]);
  assert.equal(pool.life[0], 0.5);
  assert.equal(pool.maxLife[0], 0.5);
  assert.equal(pool.size[0], 9);
  assert.deepEqual(
    [...pool.color.slice(0, 3)].map((c) => Math.round(c * 10) / 10),
    [0.1, 0.2, 0.3]
  );
});

test('spawn ignores particles with no lifetime', () => {
  const pool = createPool(2);
  assert.equal(spawn(pool, particle({ life: 0 })), -1);
  assert.equal(aliveCount(pool), 0);
});

test('step integrates velocity with gravity and moves positions', () => {
  const pool = createPool(2);
  spawn(pool, particle({ vx: 2, vy: 1, vz: -1, life: 10 }));
  step(pool, 0.5, -4);
  assert.equal(pool.velocities[1], 1 - 4 * 0.5);
  assert.equal(pool.positions[0], 1 + 2 * 0.5);
  assert.equal(pool.positions[1], 2 + -1 * 0.5);
  assert.equal(pool.positions[2], 3 + -1 * 0.5);
  assert.equal(pool.life[0], 9.5);
});

test('step kills expired particles and updates the alive count', () => {
  const pool = createPool(3);
  spawn(pool, particle({ life: 0.3 }));
  spawn(pool, particle({ life: 1 }));
  assert.equal(aliveCount(pool), 2);
  step(pool, 0.2);
  assert.equal(aliveCount(pool), 2);
  step(pool, 0.2);
  assert.equal(aliveCount(pool), 1);
  assert.equal(pool.life[0], 0);
  assert.ok(pool.life[1] > 0);
  step(pool, 2);
  assert.equal(aliveCount(pool), 0);
});

test('dead particles are not moved by step', () => {
  const pool = createPool(1);
  spawn(pool, particle({ vx: 1, life: 0.1 }));
  step(pool, 0.2);
  const x = pool.positions[0];
  step(pool, 1);
  assert.equal(pool.positions[0], x);
});

test('freed slots are reused before overwriting live particles', () => {
  const pool = createPool(3);
  spawn(pool, particle({ life: 0.1 }));
  spawn(pool, particle({ life: 5 }));
  spawn(pool, particle({ life: 5 }));
  step(pool, 0.2);
  assert.equal(aliveCount(pool), 2);
  const slot = spawn(pool, particle({ life: 5, x: 42 }));
  assert.equal(slot, 0);
  assert.equal(pool.positions[0], 42);
  assert.equal(aliveCount(pool), 3);
});

test('overflow drops the oldest particle and keeps the count at capacity', () => {
  const pool = createPool(2);
  spawn(pool, particle({ x: 1, life: 5 }));
  spawn(pool, particle({ x: 2, life: 5 }));
  const slot = spawn(pool, particle({ x: 3, life: 5 }));
  assert.equal(slot, 0);
  assert.equal(aliveCount(pool), 2);
  assert.equal(pool.positions[0], 3);
  assert.equal(pool.positions[3], 2);
  spawn(pool, particle({ x: 4, life: 5 }));
  assert.equal(pool.positions[3], 4);
  assert.equal(aliveCount(pool), 2);
});

test('mulberry32 is deterministic for a seed and stays in [0, 1)', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(seqA, Array.from({ length: 20 }, mulberry32(8)));
});

test('hexColor parses #rrggbb into unit floats', () => {
  assert.deepEqual(hexColor('#ff0000'), [1, 0, 0]);
  const [r, g, b] = hexColor('#80ff00');
  assert.ok(Math.abs(r - 128 / 255) < 1e-9);
  assert.equal(g, 1);
  assert.equal(b, 0);
});

test('burstSpawns maps velocities to spawns at the origin', () => {
  const spawns = burstSpawns({ x: 1, y: 2, z: 3 }, [{ x: 4, y: 5, z: 6 }], { life: 0.4, size: 3, color: WHITE });
  assert.deepEqual(spawns, [{ x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6, life: 0.4, size: 3, color: WHITE }]);
});

test('coneSpawns is deterministic per rng and stays within spread around dir', () => {
  const opts = { speedMin: 2, speedMax: 4, spread: 0.2, life: 1, size: 2, color: WHITE };
  const dir = { x: 1, y: 0, z: 0 };
  const a = coneSpawns(mulberry32(3), { x: 0, y: 0, z: 0 }, dir, 16, opts);
  const b = coneSpawns(mulberry32(3), { x: 0, y: 0, z: 0 }, dir, 16, opts);
  assert.deepEqual(a, b);
  assert.equal(a.length, 16);
  for (const s of a) {
    const speed = Math.hypot(s.vx, s.vy, s.vz);
    assert.ok(speed >= 2 - 1e-9 && speed <= 4 + 1e-9);
    assert.ok(s.vx / speed >= Math.cos(0.2) - 1e-9);
  }
});
