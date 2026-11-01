import { cellKey } from '../../../engine/map.ts';
import { seededNoise } from '../textures/tiles.js';

// Pure per-cell ground data for the procedural grass shader. One RGBA texel per (x, z).
// Texel layout matches fogData.js: row = size - 1 - z, so the shader's UV mapping is shared.
//   R = structure (255 structure, 0 otherwise)
//   G = unseen (255 when the cell is not in visibleCellKeys, 0 when visible)
//   B = per-cell hash byte from seededNoise(seed, x, z, GROUND_HASH_SALT)
//   A = 255

export const GROUND_HASH_SALT = 91;
export const GROUND_STRUCTURE = 255;
export const GROUND_UNSEEN = 255;

export function groundTexelIndex(size, x, z) {
  return (size - 1 - z) * size + x;
}

export function buildGroundData(map, visibleCellKeys) {
  const size = map.size;
  const data = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = groundTexelIndex(size, x, z) * 4;
      const cell = map.cells[cellKey({ x, z, level: 0 })];
      const hash = seededNoise(map.seed, x, z, GROUND_HASH_SALT);
      data[offset] = cell?.structure ? GROUND_STRUCTURE : 0;
      data[offset + 1] = visibleCellKeys.has(cellKey({ x, z, level: 0 })) ? 0 : GROUND_UNSEEN;
      data[offset + 2] = Math.min(255, Math.floor(hash * 256));
      data[offset + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}
