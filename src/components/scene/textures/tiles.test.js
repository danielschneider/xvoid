import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installCanvasStub } from '../../../../test/canvasStub.js';
import { createGroundTexture, createTileTexture, seededNoise, TILE_PITCH, TILE_SIZE } from './tiles.js';

test('seededNoise is deterministic and in [0, 1)', () => {
  for (let x = -5; x < 30; x += 1) {
    for (let z = 0; z < 30; z += 1) {
      const value = seededNoise(42, x, z, 47);
      assert.equal(value, seededNoise(42, x, z, 47));
      assert.ok(value >= 0 && value < 1, `out of range at ${x},${z}: ${value}`);
    }
  }
});

test('seededNoise depends on seed, salt and position', () => {
  assert.notEqual(seededNoise(1, 3, 4, 0), seededNoise(2, 3, 4, 0));
  assert.notEqual(seededNoise(1, 3, 4, 0), seededNoise(1, 3, 4, 47));
  assert.notEqual(seededNoise(1, 3, 4, 0), seededNoise(1, 4, 3, 0));
});

test('createTileTexture copies one 16px tile from the atlas and sets nearest filters', () => {
  const stub = installCanvasStub();
  try {
    const atlas = { width: 272, height: 272 };
    const texture = createTileTexture(atlas, 5, 14);
    const canvas = stub.created[0];
    assert.equal(canvas.width, TILE_SIZE);
    assert.equal(canvas.height, TILE_SIZE);
    const draw = canvas.calls.find((call) => call.op === 'drawImage');
    assert.deepEqual(draw.args.slice(1), [5 * TILE_PITCH, 14 * TILE_PITCH, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE]);
    assert.equal(texture.magFilter, THREE.NearestFilter);
    assert.equal(texture.minFilter, THREE.NearestFilter);
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  } finally {
    stub.uninstall();
  }
});

test('createGroundTexture paints every cell and darkens only unseen cells', () => {
  const stub = installCanvasStub();
  try {
    const cells = {};
    for (let z = 0; z < 2; z += 1) {
      for (let x = 0; x < 2; x += 1) cells[`${x},${z},0`] = { x, z, level: 0, walkable: true, cover: 0 };
    }
    const map = { size: 2, seed: 7, cells };
    const visible = new Set(['0,0,0']);
    const texture = createGroundTexture({ width: 272, height: 272 }, map, visible);
    const canvas = stub.created[0];
    assert.equal(canvas.width, 2 * TILE_SIZE);
    assert.equal(canvas.height, 2 * TILE_SIZE);
    const fogFills = canvas.calls.filter((call) => call.op === 'set' && call.key === 'fillStyle' && call.value === '#080d0e');
    assert.equal(fogFills.length, 3);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.anisotropy, 1);
  } finally {
    stub.uninstall();
  }
});

test('createGroundTexture is deterministic for the same map and visibility', () => {
  const stub = installCanvasStub();
  try {
    const cells = { '0,0,0': { x: 0, z: 0, level: 0, walkable: true, cover: 0 } };
    const map = { size: 1, seed: 3, cells };
    const atlas = { width: 272, height: 272 };
    createGroundTexture(atlas, map, new Set(['0,0,0']));
    createGroundTexture(atlas, map, new Set(['0,0,0']));
    assert.deepEqual(stub.created[0].calls, stub.created[1].calls);
  } finally {
    stub.uninstall();
  }
});
