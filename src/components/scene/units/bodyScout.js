import { part, armorColorFor } from './bodyPart.js';
import { limb } from './bodyLimb.js';

// Void Scout: small horizontal bird. Body lies level, neck leans forward, head with beak and crest, tail trails
// backward and up, two thin jointed legs. No arms, no rifle.
export const DIMENSIONS = { scale: 0.7, groundY: 0, spriteY: 0.574, labelY: 1.1 };

const BEAK = '#ffd9a8';
const DARK = '#20302f';

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const parts = [
    part('box', [0.34, 0.3, 0.62], [0, 0.62, 0], armor, { roughness: 0.75, metalness: 0.2 }), // body
    part('box', [0.14, 0.3, 0.14], [0, 0.82, 0.3], armor, { rotation: [0.5, 0, 0], roughness: 0.75, metalness: 0.2 }), // neck
    part('box', [0.24, 0.22, 0.26], [0, 1.0, 0.42], armor, { roughness: 0.75, metalness: 0.2 }), // head
    part('cone', [0.06, 0.22, 4], [0, 0.98, 0.66], BEAK, {
      rotation: [Math.PI / 2, 0, 0],
      roughness: 0.6,
      metalness: 0,
    }),
    part('box', [0.05, 0.2, 0.1], [0, 1.14, 0.36], unit.color, {
      rotation: [-0.3, 0, 0],
      roughness: 0.6,
      metalness: 0.3,
    }),
    limb([0, 0.66, -0.3], [0, 0.88, -0.7], 0.1, unit.color, { roughness: 0.7 }), // tail
  ];
  for (const side of [-1, 1]) {
    const x = side * 0.1;
    parts.push(
      limb([x, 0.5, 0], [x, 0.25, 0.12], 0.05, DARK, { metalness: 0 }), // thigh
      limb([x, 0.25, 0.12], [x, 0.02, -0.02], 0.05, DARK, { metalness: 0 }) // shin
    );
  }
  return { parts, rifle: null };
}
