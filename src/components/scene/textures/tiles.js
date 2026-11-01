// Deterministic per-cell noise in [0, 1). Same inputs always give the same value.
export function seededNoise(seed, x, z, salt = 0) {
  let value = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
