import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWallTexture } from './wallTexture.js';
import { createStoneTexture } from './stoneTexture.js';
import { createEarthTexture } from './earthTexture.js';
import { runGenerator } from './proceduralTest.helpers.js';

const GENERATORS = [
  ['wall', createWallTexture, 16],
  ['stone', createStoneTexture, 16],
  ['earth', createEarthTexture, 16],
];

for (const [name, generator, size] of GENERATORS) {
  test(`${name} texture is a nearest-filtered sRGB CanvasTexture of ${size}px`, () => {
    const { texture, canvas } = runGenerator(generator, 1234);
    assert.ok(texture instanceof THREE.CanvasTexture);
    assert.equal(canvas.width, size);
    assert.equal(canvas.height, size);
    assert.equal(texture.magFilter, THREE.NearestFilter);
    assert.equal(texture.minFilter, THREE.NearestFilter);
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  });

  test(`${name} texture paints one rect per pixel`, () => {
    const { rects } = runGenerator(generator, 1234);
    assert.equal(rects.length, size * size);
  });

  test(`${name} texture is deterministic for the same seed`, () => {
    const first = runGenerator(generator, 777).fills;
    const second = runGenerator(generator, 777).fills;
    assert.deepEqual(second, first);
  });

  test(`${name} texture changes with the seed`, () => {
    const first = runGenerator(generator, 1).fills;
    const second = runGenerator(generator, 2).fills;
    assert.notDeepEqual(second, first);
  });
}
