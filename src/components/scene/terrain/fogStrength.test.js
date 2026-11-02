import test from 'node:test';
import assert from 'node:assert/strict';
import { cellKey } from '../../../engine/map.ts';
import { buildFogLayers, FOG_HIDDEN, FOG_SLIGHT, FOG_VISIBLE } from './fogData.js';
import { buildGroundData, groundTexelIndex, GROUND_SLIGHT, GROUND_UNSEEN } from './groundData.js';

const cell = (x, z, level = 0) => ({ x, z, level });
const keys = (...cells) => new Set(cells.map((c) => cellKey(c)));

test('elevated cell seen before but not now is slight fog, never seen is deep fog', () => {
  const cells = [cell(0, 0, 1), cell(1, 0, 1), cell(2, 0, 1)];
  const [layer] = buildFogLayers(3, cells, keys(cell(2, 0, 1)), keys(cell(0, 0, 1), cell(2, 0, 1)));
  assert.equal(layer.bytes[(3 - 1 - 0) * 3 + 0], FOG_SLIGHT);
  assert.equal(layer.bytes[(3 - 1 - 0) * 3 + 1], FOG_HIDDEN);
  assert.equal(layer.bytes[(3 - 1 - 0) * 3 + 2], FOG_VISIBLE);
});

test('ground G channel encodes deep fog, slight fog and visible', () => {
  const map = { size: 3, seed: 1, cells: {} };
  for (let z = 0; z < 3; z += 1)
    for (let x = 0; x < 3; x += 1) map.cells[cellKey(cell(x, z))] = { ...cell(x, z), structure: false };
  const { data } = buildGroundData(map, keys(cell(0, 0)), keys(cell(1, 1)));
  const g = (x, z) => data[groundTexelIndex(3, x, z) * 4 + 1];
  assert.equal(g(0, 0), 0, 'visible');
  assert.equal(g(1, 1), GROUND_SLIGHT, 'slight fog');
  assert.equal(g(2, 2), GROUND_UNSEEN, 'deep fog');
});
