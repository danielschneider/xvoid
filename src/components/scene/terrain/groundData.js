import { cellKey } from '../../../engine/map.ts';
import { seededNoise } from '../textures/tiles.js';

// Pure per-cell ground data for the procedural grass shader. One RGBA texel per (x, z).
// Texel layout matches fogData.js: row = size - 1 - z, so the shader's UV mapping is shared.
//   R = structure (255 structure, 0 otherwise)
//   G = fog strength: 255 deep fog (never seen), 128 slight fog (seen before, not visible), 0 visible
//   B = per-cell hash byte from seededNoise(seed, x, z, GROUND_HASH_SALT)
//   A = 255

export const GROUND_HASH_SALT = 91;
export const GROUND_STRUCTURE = 255;
export const GROUND_UNSEEN = 255;
export const GROUND_SLIGHT = 128;

export function groundTexelIndex(size, x, z) {
  return (size - 1 - z) * size + x;
}

function fogStrength(key, visibleCellKeys, exploredCellKeys) {
  if (visibleCellKeys.has(key)) return 0;
  return exploredCellKeys.has(key) ? GROUND_SLIGHT : GROUND_UNSEEN;
}

export function buildGroundData(map, visibleCellKeys, exploredCellKeys = new Set()) {
  const size = map.size;
  const data = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = groundTexelIndex(size, x, z) * 4;
      const cell = map.cells[cellKey({ x, z, level: 0 })];
      const hash = seededNoise(map.seed, x, z, GROUND_HASH_SALT);
      data[offset] = cell?.structure ? GROUND_STRUCTURE : 0;
      data[offset + 1] = fogStrength(cellKey({ x, z, level: 0 }), visibleCellKeys, exploredCellKeys);
      data[offset + 2] = Math.min(255, Math.floor(hash * 256));
      data[offset + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}
