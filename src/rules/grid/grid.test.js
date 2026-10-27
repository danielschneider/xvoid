import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../engine/game.js';
import { cellKey, getReachable, isPassable } from '../../engine/map.js';

test('creates a seeded 32x32 battlefield with traversable upper levels', () => {
  const state = createInitialState(42);
  assert.equal(state.map.size, 32);
  assert.equal(state.map.seed, 42);
  assert.ok(state.map.cells[cellKey({ x: 6, z: 5, level: 1 })]);
  const paths = getReachable(state.map, { x: 6, z: 5, level: 0 });
  assert.ok(paths.has(cellKey({ x: 6, z: 5, level: 1 })));
});

test('boxes (pillar/console) are never passable and never reachable', () => {
  for (const seed of [42, 7, 9001, 123456]) {
    const map = createInitialState(seed).map;
    const boxes = Object.values(map.cells).filter((cell) => cell.terrain === 'pillar' || cell.terrain === 'console');
    assert.ok(boxes.length > 0, `seed ${seed} has boxes`);
    assert.ok(boxes.every((box) => !isPassable(box)));
    const reachable = getReachable(map, { x: 0, z: 0, level: 0 }, new Set(), map.size * 4);
    assert.ok(
      boxes.every((box) => !reachable.has(cellKey(box))),
      `seed ${seed}: no path enters a box`
    );
  }
});

test('boxes never disconnect the battlefield', () => {
  for (const seed of [42, 7, 9001, 123456, 555]) {
    const map = createInitialState(seed).map;
    const passable = Object.values(map.cells).filter(isPassable);
    const reachable = getReachable(map, { x: 0, z: 0, level: 0 }, new Set(), map.size * 4);
    const reachableCount = passable.filter(
      (cell) => (cell.x === 0 && cell.z === 0) || reachable.has(cellKey(cell))
    ).length;
    assert.equal(reachableCount, passable.length, `seed ${seed}: all passable cells connected`);
  }
});
