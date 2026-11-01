import test from 'node:test';
import assert from 'node:assert/strict';
import { cellKey } from '../../../engine/map.ts';
import { buildGroundData, groundTexelIndex } from './groundData.js';

function makeMap(size, seed, structureAt = []) {
  const cells = {};
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      cells[cellKey({ x, z, level: 0 })] = { x, z, level: 0, structure: structureAt.includes(`${x},${z}`) };
    }
  }
  return { size, seed, cells };
}

const keysFor = (cells) => new Set(cells.map(([x, z]) => cellKey({ x, z, level: 0 })));

test('output length is size * size * 4 and dimensions match the map', () => {
  const { data, width, height } = buildGroundData(makeMap(5, 1), new Set());
  assert.equal(data.length, 5 * 5 * 4);
  assert.equal(width, 5);
  assert.equal(height, 5);
});

test('R flags structure cells and G flags unseen cells', () => {
  const map = makeMap(3, 9, ['1,2']);
  const visible = keysFor([[0, 0]]);
  const { data } = buildGroundData(map, visible);
  const at = (x, z) => groundTexelIndex(3, x, z) * 4;
  assert.equal(data[at(1, 2)], 255, 'structure R');
  assert.equal(data[at(0, 0)], 0, 'non-structure R');
  assert.equal(data[at(0, 0) + 1], 0, 'visible cell G');
  assert.equal(data[at(1, 2) + 1], 255, 'unseen cell G');
  assert.equal(data[at(2, 2) + 1], 255, 'unseen cell G');
});

test('alpha is always 255', () => {
  const { data } = buildGroundData(makeMap(4, 2, ['0,0']), keysFor([[1, 1]]));
  for (let i = 3; i < data.length; i += 4) assert.equal(data[i], 255);
});

test('output is deterministic across calls', () => {
  const map = makeMap(6, 42, ['2,3']);
  const visible = keysFor([
    [0, 0],
    [4, 4],
  ]);
  assert.deepEqual(buildGroundData(map, visible).data, buildGroundData(map, visible).data);
});

test('per-cell hash byte varies across cells', () => {
  const size = 8;
  const { data } = buildGroundData(makeMap(size, 7), new Set());
  const hashes = new Set();
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) hashes.add(data[groundTexelIndex(size, x, z) * 4 + 2]);
  }
  assert.ok(hashes.size > size * size * 0.8, `only ${hashes.size} distinct hash bytes`);
});
