import test from 'node:test';
import assert from 'node:assert/strict';
import { missOvershoot } from './trajectory.js';
import { MISS_OVERSHOOT } from '../constants.js';

const cell = (x, z, terrain = 'floor') => [
  `${x},${z},0`,
  { x, z, level: 0, terrain, walkable: terrain === 'floor', cover: 0 },
];
const map = (walls = []) => ({
  cells: Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => {
      const x = i % 10;
      const z = Math.floor(i / 10);
      return cell(x, z, walls.some(([wx, wz]) => wx === x && wz === z) ? 'wall' : 'floor');
    })
  ),
});
const shooter = { x: 0, z: 1, level: 0 };
const target = { x: 2, z: 1, level: 0 };

test('a miss overshoots the target by the full MISS_OVERSHOOT on open ground', () => {
  assert.equal(missOvershoot(map(), shooter, target), MISS_OVERSHOOT);
});

test('a wall past the target stops the overshoot before it', () => {
  assert.equal(missOvershoot(map([[4, 1]]), shooter, target), 1.4);
});

test('a wall directly behind the target yields no overshoot', () => {
  assert.equal(missOvershoot(map([[3, 1]]), shooter, target), 0.4);
});
