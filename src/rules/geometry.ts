// Plane distance on the x/z grid (levels are ignored).
export const spawnDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const facingToward = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
