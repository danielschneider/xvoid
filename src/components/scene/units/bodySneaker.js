import { part, armorColorFor } from './bodyPart.js';

// Void Sneaker: slim, low serpent. A row of tapering body segments in a gentle S-curve, a small head and no legs. No rifle.
export const DIMENSIONS = { scale: 0.9, groundY: 0, spriteY: 0.738, labelY: 1.2 };

// Segment [x, z, size]: the tail tapers toward the head, which sits at the front (+z).
const SEGMENTS = [
  [0.0, -0.5, 0.2],
  [0.03, -0.3, 0.22],
  [-0.03, -0.1, 0.24],
  [0.03, 0.1, 0.24],
  [-0.02, 0.28, 0.24],
];

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const parts = SEGMENTS.map(([x, z, size], index) =>
    part('box', [size, size * 0.8, 0.2], [x, 0.12, z], index % 2 ? armor : unit.color, {
      roughness: 0.6,
      metalness: 0.3,
    })
  );
  parts.push(
    part('box', [0.2, 0.16, 0.26], [0, 0.13, 0.5], unit.color, { roughness: 0.55, metalness: 0.3 }),
    part('sphere', [0.035, 6, 4], [-0.07, 0.2, 0.6], '#eaffcf', { roughness: 0.4, metalness: 0 }),
    part('sphere', [0.035, 6, 4], [0.07, 0.2, 0.6], '#eaffcf', { roughness: 0.4, metalness: 0 })
  );
  return { parts, rifle: null };
}
