import { part, armorColorFor } from './bodyPart.js';

// Void Raider: hunched quadruped brute. Wide low body, big head forward with tusks and horns, four thick stumpy legs.
// No arms, no rifle.
export const DIMENSIONS = { scale: 1.1, groundY: 0, spriteY: 0.902, labelY: 1.6 };

const BONE = '#f2f0d0';
const DARK = '#20302f';

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const parts = [
    part('box', [1.1, 0.46, 0.8], [0, 0.5, 0], armor, { roughness: 0.85, metalness: 0.15 }), // body
    part('box', [0.5, 0.4, 0.5], [0, 0.62, 0.6], armor, { roughness: 0.85, metalness: 0.15 }), // head
    part('box', [0.36, 0.18, 0.24], [0, 0.5, 0.9], unit.color, { roughness: 0.68, metalness: 0.28 }), // snout
  ];
  for (const side of [-1, 1]) {
    parts.push(
      part('cone', [0.07, 0.3, 5], [side * 0.16, 0.46, 1.0], BONE, { rotation: [1.07, 0, 0], metalness: 0 }), // tusk
      part('cone', [0.08, 0.3, 5], [side * 0.18, 0.9, 0.45], BONE, { rotation: [0, 0, -side * 0.25], metalness: 0 }), // horn
      part('cone', [0.09, 0.28, 5], [side * 0.35, 0.8, -0.1], BONE, { rotation: [0, 0, -side * 0.2], metalness: 0 }) // back spike
    );
  }
  for (const x of [-0.38, 0.38]) {
    for (const z of [-0.28, 0.28]) {
      parts.push(part('box', [0.24, 0.44, 0.26], [x, 0.22, z], DARK, { roughness: 0.9, metalness: 0 }));
    }
  }
  return { parts, rifle: null };
}
