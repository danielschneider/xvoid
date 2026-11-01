import { part, armorColorFor } from './bodyPart.js';

// Void Crawler: small, low and wide flat shell with four short splayed legs.
export const DIMENSIONS = { scale: 0.6, groundY: 0, spriteY: 0.492, labelY: 1.0 };

// Legs splay outward: side is -1 (left) or 1 (right); the foot swings out along x.
const LEG_POSITIONS = [
  [-1, 0.22],
  [1, 0.22],
  [-1, -0.22],
  [1, -0.22],
];

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const legs = LEG_POSITIONS.map(([side, z]) =>
    part('box', [0.12, 0.3, 0.12], [side * 0.42, 0.15, z], '#20302f', { rotation: [0, 0, side * 0.5], metalness: 0 })
  );
  return {
    parts: [
      part('box', [0.9, 0.26, 0.7], [0, 0.36, 0], armor, { roughness: 0.7, metalness: 0.3 }),
      part('box', [0.5, 0.06, 0.5], [0, 0.51, 0], unit.color, { roughness: 0.6, metalness: 0.3 }),
      part('sphere', [0.07, 8, 6], [-0.2, 0.42, 0.36], '#eaffcf', { roughness: 0.4, metalness: 0 }),
      part('sphere', [0.07, 8, 6], [0.2, 0.42, 0.36], '#eaffcf', { roughness: 0.4, metalness: 0 }),
      ...legs,
    ],
    rifle: null,
  };
}
