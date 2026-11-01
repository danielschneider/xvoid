import test from 'node:test';
import assert from 'node:assert/strict';
import { hasLineOfSight } from './line.ts';
import { getVisibleCells } from './fog.ts';
import { cellKey } from '../grid/cells.ts';

// 7x7 open floor on level 0, with a wall column at x=3 covering z=0..1 (ending at z=1.5).
// Shooter at (2,2) is level with the wall end; its lean reaches z=2.45 while the wall stops at z=1.5.
function makeMap() {
  const cells = {};
  for (let x = 0; x < 7; x += 1) {
    for (let z = 0; z < 7; z += 1) {
      const wall = x === 3 && z <= 1;
      cells[cellKey({ x, z, level: 0 })] = {
        x,
        z,
        level: 0,
        terrain: wall ? 'wall' : 'floor',
        walkable: !wall,
        cover: 0,
        structure: false,
      };
    }
  }
  return { seed: 1, size: 7, theme: 'test', rooms: [], cells, transitions: {} };
}

test('a shooter can lean past a wall end to a target in open ground', () => {
  const map = makeMap();
  const shooter = { x: 2, z: 2, level: 0 };
  const target = { x: 4, z: 2, level: 0 };
  assert.equal(hasLineOfSight(map, shooter, target), true);
});

test('a wall that covers the whole gap still blocks sight', () => {
  const map = makeMap();
  for (let z = 0; z < 7; z += 1) map.cells[cellKey({ x: 3, z, level: 0 })].terrain = 'wall';
  assert.equal(hasLineOfSight(map, { x: 2, z: 2, level: 0 }, { x: 4, z: 2, level: 0 }), false);
});

test('fog reveals an enemy around a wall end when the observer leans', () => {
  const map = makeMap();
  const observer = { id: 'p', x: 2, z: 2, level: 0, team: 'player', hp: 3 };
  const enemyCell = { x: 4, z: 2, level: 0 };
  assert.ok(getVisibleCells(map, [observer]).has(cellKey(enemyCell)));
});
