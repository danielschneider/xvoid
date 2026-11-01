import { part, armorColorFor } from './bodyPart.js';

// Humanoid player and infantry body: the original box layout, kept identical so player visuals do not change.
export const DIMENSIONS = { scale: 1, groundY: 0, spriteY: 0.82, labelY: 1.95 };

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const parts = [
    part('box', [0.48, 0.58, 0.32], [0, 0.79, 0], armor, { roughness: 0.78, metalness: 0.24 }),
    part('box', [0.7, 0.2, 0.38], [0, 1.05, 0], unit.color, { roughness: 0.68, metalness: 0.28 }),
    part('box', [0.34, 0.34, 0.34], [0, 1.31, 0], '#b7b5a2', { roughness: 0.82, metalness: 0.12 }),
    part('box', [0.2, 0.42, 0.25], [-0.17, 0.31, 0], '#242f2a', { roughness: 0.9, metalness: 0 }),
    part('box', [0.2, 0.42, 0.25], [0.17, 0.31, 0], '#242f2a', { roughness: 0.9, metalness: 0 }),
  ];
  const rifle = {
    position: [0.28, 0.91, 0.16],
    rotation: [0.12, 0, -0.12],
    parts: [
      part('box', [0.14, 0.14, 0.5], [0, 0, 0], '#202722', { roughness: 0.55, metalness: 0.52 }),
      part('box', [0.07, 0.07, 0.22], [0, 0, 0.33], '#a39a7d', { roughness: 0.42, metalness: 0.62 }),
    ],
  };
  return { parts, rifle };
}
