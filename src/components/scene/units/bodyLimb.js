import { part } from './bodyPart.js';

// A limb segment from point a to point b, as a box along the segment. Points are [x, y, z].
// The segment must lie in the x–y plane (z equal) or the y–z plane (x equal); other directions throw.
export function limb(a, b, thickness, color, options = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  let rotation;
  if (Math.abs(dz) < 1e-9) {
    // Box +y rotated about z: (0, 1) maps to (-sin a, cos a).
    rotation = [0, 0, Math.atan2(-dx, dy)];
  } else if (Math.abs(dx) < 1e-9) {
    // Box +y rotated about x: (0, 1) maps to (0, cos a, sin a).
    rotation = [Math.atan2(dz, dy), 0, 0];
  } else {
    throw new Error('limb must lie in the x–y or y–z plane');
  }
  return part('box', [thickness, length, thickness], middle, color, { ...options, rotation });
}
