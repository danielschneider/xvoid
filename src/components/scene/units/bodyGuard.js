import { part, armorColorFor } from './bodyPart.js';

// Void Guard: beetle with a large domed carapace, a small head and six legs splayed out from a low body. No upright torso, no arms, no rifle.
export const DIMENSIONS = { scale: 1.05, groundY: 0, spriteY: 0.861, labelY: 1.6 };

const DARK = '#20302f';
const LEG_Z = [-0.3, 0, 0.3];
const LEG_LENGTH = 0.36;

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const parts = [
    part('sphere', [0.55, 14, 10], [0, 0.42, 0], unit.color, { roughness: 0.5, metalness: 0.35 }),
    part('box', [0.12, 0.12, 0.9], [0, 0.9, 0], armor, { roughness: 0.7, metalness: 0.2 }),
    part('box', [0.5, 0.2, 0.3], [0, 0.22, 0.45], armor, { roughness: 0.8, metalness: 0.15 }),
    part('box', [0.12, 0.1, 0.12], [-0.1, 0.36, 0.56], '#eaffcf', { roughness: 0.4, metalness: 0 }),
    part('box', [0.12, 0.1, 0.12], [0.1, 0.36, 0.56], '#eaffcf', { roughness: 0.4, metalness: 0 }),
  ];
  for (const side of [-1, 1]) {
    for (const z of LEG_Z) {
      parts.push(
        part('box', [0.1, LEG_LENGTH, 0.1], [side * 0.5, 0.18, z], DARK, { rotation: [0, 0, side * 0.5], metalness: 0 })
      );
    }
  }
  return { parts, rifle: null };
}
