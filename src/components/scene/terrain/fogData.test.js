import test from 'node:test';
import assert from 'node:assert/strict';
import { cellKey } from '../../../engine/map.ts';
import { buildFogLayers, FOG_HIDDEN, FOG_VISIBLE, fogTexelIndex, getMapSpan, sampleFogSmooth } from './fogData.js';

const cell = (x, z, level = 0) => ({ x, z, level });
const keysOf = (...cells) => new Set(cells.map((c) => cellKey(c)));
const layerAt = (layers, level) => layers.find((layer) => layer.level === level)?.bytes;

test('getMapSpan returns max coordinate plus one', () => {
  assert.equal(getMapSpan([cell(0, 0), cell(4, 2), cell(1, 6, 2)]), 7);
  assert.equal(getMapSpan([]), 0);
});

test('ground cells are never fogged, visible or not', () => {
  const cells = [cell(0, 0), cell(1, 0), cell(0, 1)];
  assert.deepEqual(buildFogLayers(2, cells, new Set()), []);
});

test('hidden elevated cell is fogged, visible one is clear', () => {
  const cells = [cell(0, 0), cell(1, 1), cell(1, 1, 1), cell(2, 2), cell(2, 2, 1)];
  const layers = buildFogLayers(3, cells, keysOf(cell(2, 2), cell(2, 2, 1)));
  const bytes = layerAt(layers, 1);
  assert.equal(bytes[fogTexelIndex(3, 1, 1)], FOG_HIDDEN);
  assert.equal(bytes[fogTexelIndex(3, 2, 2)], FOG_VISIBLE);
  assert.equal(bytes[fogTexelIndex(3, 0, 0)], FOG_VISIBLE);
});

test('a hidden upper floor is fogged even when its ground cell is visible', () => {
  const cells = [cell(1, 1), cell(1, 1, 1)];
  const layers = buildFogLayers(2, cells, keysOf(cell(1, 1)));
  assert.equal(layerAt(layers, 1)[fogTexelIndex(2, 1, 1)], FOG_HIDDEN);
});

test('a visible upper floor does not clear a hidden floor in the same column', () => {
  const cells = [cell(1, 1, 1), cell(1, 1, 2)];
  const layers = buildFogLayers(2, cells, keysOf(cell(1, 1, 2)));
  assert.equal(layerAt(layers, 1)[fogTexelIndex(2, 1, 1)], FOG_HIDDEN);
  assert.equal(layerAt(layers, 2), undefined, 'fully visible level produces no layer');
});

test('each level gets its own layer with only its own cells fogged', () => {
  const cells = [cell(0, 0, 1), cell(0, 0, 2), cell(1, 0, 2)];
  const layers = buildFogLayers(2, cells, keysOf(cell(0, 0, 2)));
  assert.deepEqual(
    layers.map((layer) => layer.level),
    [1, 2]
  );
  const level1 = layerAt(layers, 1);
  const level2 = layerAt(layers, 2);
  assert.equal(level1[fogTexelIndex(2, 0, 0)], FOG_HIDDEN);
  assert.equal(level2[fogTexelIndex(2, 0, 0)], FOG_VISIBLE);
  assert.equal(level2[fogTexelIndex(2, 1, 0)], FOG_HIDDEN);
  assert.equal(level1[fogTexelIndex(2, 1, 0)], FOG_VISIBLE);
});

test('texel layout: x is the column, z runs bottom-up in texture rows', () => {
  const size = 4;
  const [layer] = buildFogLayers(size, [cell(3, 0, 1)], new Set());
  assert.equal(fogTexelIndex(size, 3, 0), (size - 1) * size + 3);
  assert.equal(layer.bytes[(size - 1) * size + 3], FOG_HIDDEN);
  assert.equal(
    layer.bytes.reduce((n, v) => n + (v === FOG_HIDDEN ? 1 : 0), 0),
    1
  );
});

test('every hidden elevated cell maps to exactly one fogged texel of its level', () => {
  const cells = [cell(0, 0, 1), cell(1, 0, 1), cell(0, 1, 1), cell(1, 1, 3), cell(1, 1, 1)];
  const layers = buildFogLayers(2, cells, keysOf(cell(1, 0, 1)));
  const fogged = layers.flatMap((layer) =>
    [...layer.bytes].map((v, i) => (v === FOG_HIDDEN ? `${layer.level}:${i}` : null)).filter(Boolean)
  );
  assert.equal(fogged.length, 4);
  assert.ok(fogged.includes(`1:${fogTexelIndex(2, 0, 0)}`));
  assert.ok(fogged.includes(`1:${fogTexelIndex(2, 0, 1)}`));
  assert.ok(fogged.includes(`1:${fogTexelIndex(2, 1, 1)}`));
  assert.ok(fogged.includes(`3:${fogTexelIndex(2, 1, 1)}`));
});

test('out-of-range elevated cells are ignored', () => {
  assert.deepEqual(buildFogLayers(2, [cell(5, 5, 1)], new Set()), []);
});

test('sampleFogSmooth returns 1 for clear texels and 0 for fully fogged ones', () => {
  const size = 3;
  const clear = new Uint8Array(9).fill(FOG_VISIBLE);
  const fogged = new Uint8Array(9).fill(FOG_HIDDEN);
  assert.equal(sampleFogSmooth(clear, size, 0.5, 0.5), 1);
  assert.equal(sampleFogSmooth(fogged, size, 0.5, 0.5), 0);
});

test('sampleFogSmooth softens an edge between clear and fogged texels', () => {
  const size = 2;
  const bytes = new Uint8Array([FOG_VISIBLE, FOG_HIDDEN, FOG_VISIBLE, FOG_HIDDEN]);
  const value = sampleFogSmooth(bytes, size, 0.5, 0.5);
  assert.ok(value > 0 && value < 1, `expected intermediate value, got ${value}`);
});
