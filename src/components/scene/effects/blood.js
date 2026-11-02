// Pure blood effect data: colours, counts and ground stain placement. No three.js or React imports.
// Visual randomness is seeded by the shot id so the same shot always looks the same.

export const BLOOD_COLOR = [0.35, 1, 0.3];
export const BLOOD_CORE_COLOR = [0.7, 1, 0.55];
export const BLOOD_SPARK_LIFE = 0.6;
export const BLOOD_SPARK_SIZE = 8;
export const BLOOD_SPARK_COUNT = 18;
export const BLOOD_SPLAT_COUNT = 3;
export const STAIN_MAX = 120;
export const STAIN_RADIUS_MIN = 0.22;
export const STAIN_RADIUS_MAX = 0.42;

// Deterministic value in [0, 1) for (seed, index). Same inputs, same output.
export function seededUnit(seed, index) {
  const x = Math.sin(seed * 127.1 + index * 311.7 + 1.23) * 43758.5453;
  return x - Math.floor(x);
}

// Ground stains for one hit: a few splats scattered around the victim's cell, sized and rotated by seed.
// Offsets are in world units relative to the cell centre.
export function bloodSplats(seed) {
  return Array.from({ length: BLOOD_SPLAT_COUNT }, (_, index) => {
    const angle = seededUnit(seed, index * 3) * Math.PI * 2;
    const dist = seededUnit(seed, index * 3 + 1) * 0.35;
    const radius = STAIN_RADIUS_MIN + seededUnit(seed, index * 3 + 2) * (STAIN_RADIUS_MAX - STAIN_RADIUS_MIN);
    return {
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      radius,
      rotation: seededUnit(seed, index + 500) * Math.PI * 2,
    };
  });
}

// Appends a stain to a bounded list, dropping the oldest once STAIN_MAX is reached.
export function addStains(stains, incoming) {
  const next = [...stains, ...incoming];
  return next.length > STAIN_MAX ? next.slice(next.length - STAIN_MAX) : next;
}

// World-space stains for a hit on a cell at (cx, cz), with a y just above the floor.
export function stainsForShot(shot, cellX, cellZ, floorY) {
  return bloodSplats(shot.id).map((splat, index) => ({
    key: `${shot.id}:${index}`,
    x: cellX + splat.x,
    y: floorY + 0.03 + index * 0.001,
    z: cellZ + splat.z,
    radius: splat.radius,
    rotation: splat.rotation,
  }));
}
