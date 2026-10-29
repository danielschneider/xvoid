import * as THREE from 'three';
import { cellKey } from '../../../engine/map.ts';

export const TILE_SIZE = 16;
export const TILE_PITCH = 17;

// Deterministic per-cell noise in [0, 1). Same inputs always give the same tile.
export function seededNoise(seed, x, z, salt = 0) {
  let value = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function createTileTexture(image, column, row) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, column * TILE_PITCH, row * TILE_PITCH, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Ground atlas for the whole map. Unseen cells are darkened by a fog rectangle.
export function createGroundTexture(atlasImage, map, visibleCellKeys) {
  const canvas = document.createElement('canvas');
  canvas.width = map.size * TILE_SIZE;
  canvas.height = map.size * TILE_SIZE;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  for (let z = 0; z < map.size; z += 1) {
    for (let x = 0; x < map.size; x += 1) {
      const cell = map.cells[cellKey({ x, z, level: 0 })];
      const variation = seededNoise(map.seed, x, z, 47);
      const tile = cell.structure
        ? variation < 0.5
          ? [6, 14]
          : [7, 14]
        : cell.cover > 0
          ? [5, 14]
          : variation < 0.055
            ? [0, 9]
            : variation < 0.16
              ? [1, 15]
              : [0, 15];
      context.fillStyle = cell.structure ? '#303c39' : '#202b2b';
      context.fillRect(x * TILE_SIZE, z * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      context.drawImage(
        atlasImage,
        tile[0] * TILE_PITCH,
        tile[1] * TILE_PITCH,
        TILE_SIZE,
        TILE_SIZE,
        x * TILE_SIZE,
        z * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
      if (!visibleCellKeys.has(cellKey({ x, z, level: 0 }))) {
        context.globalAlpha = 0.9;
        context.fillStyle = '#080d0e';
        context.fillRect(x * TILE_SIZE, z * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        context.globalAlpha = 1;
      }
    }
  }
  const groundTexture = new THREE.CanvasTexture(canvas);
  groundTexture.magFilter = THREE.NearestFilter;
  groundTexture.minFilter = THREE.NearestFilter;
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.generateMipmaps = false;
  groundTexture.anisotropy = 1;
  return groundTexture;
}
