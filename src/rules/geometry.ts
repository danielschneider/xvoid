// Plane distance on the x/z grid (levels are ignored).
export const spawnDistance = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

export const facingToward = (from: { x: number; z: number }, to: { x: number; z: number }): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

export const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
