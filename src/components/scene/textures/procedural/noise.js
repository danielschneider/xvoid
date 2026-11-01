import { seededNoise } from '../tiles.js';

export { seededNoise };

// Smooth value noise in [0, 1) over real-valued coordinates, built from the integer lattice hash.
export function valueNoise2D(seed, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = seededNoise(seed, x0, y0, 0);
  const b = seededNoise(seed, x0 + 1, y0, 0);
  const c = seededNoise(seed, x0, y0 + 1, 0);
  const d = seededNoise(seed, x0 + 1, y0 + 1, 0);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
}
