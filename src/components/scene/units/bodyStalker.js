import { part } from './bodyPart.js';
import { limb } from './bodyLimb.js';

// Void Stalker: a spider-like wraith in one colour. Low, wide three-segment body with eight long, thin, jointed legs.
// No torso-head stack, no arms, no rifle.
export const DIMENSIONS = { scale: 1.25, groundY: 0, spriteY: 1.025, labelY: 2.3 };

const LEG_Z = [-0.3, -0.12, 0.06, 0.24];
const LEG_THICKNESS = 0.05;

export function buildParts(unit) {
  const body = { roughness: 0.6, metalness: 0.2 };
  const parts = [
    part('sphere', [0.2, 12, 8], [0, 0.36, -0.22], unit.color, body), // abdomen
    part('sphere', [0.14, 12, 8], [0, 0.4, 0.05], unit.color, body), // thorax
    part('sphere', [0.1, 10, 8], [0, 0.36, 0.27], unit.color, body), // head
  ];
  for (const side of [-1, 1]) {
    for (const z of LEG_Z) {
      const hip = [side * 0.15, 0.4, z];
      const knee = [side * 0.5, 0.62, z];
      const foot = [side * 0.7, 0.02, z];
      parts.push(limb(hip, knee, LEG_THICKNESS, unit.color, body), limb(knee, foot, LEG_THICKNESS, unit.color, body));
    }
  }
  return { parts, rifle: null };
}
