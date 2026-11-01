import { part, armorColorFor } from './bodyPart.js';
import { limb } from './bodyLimb.js';

// Void Jellyfish: a large dome body floating above the ground with a glowing core and eight trailing tentacles.
// Tentacles hang in two wavy segments each. No legs, no arms, no upright torso-head stack and no rifle.
export const DIMENSIONS = { scale: 1.4, groundY: 0, spriteY: 1.148, labelY: 2.1 };

const CORE = '#f2f0d0';
const TENTACLE_COUNT = 8;
const RING_RADIUS = 0.3;
const WAVE = 0.08;

export function buildParts(unit) {
  const armor = armorColorFor(unit);
  const body = { roughness: 0.5, metalness: 0.25 };
  const parts = [
    part('sphere', [0.42, 16, 10], [0, 0.95, 0], unit.color, body), // dome
    part('sphere', [0.16, 8, 6], [0, 0.88, 0.32], CORE, { roughness: 0.4, metalness: 0 }), // glowing core
  ];
  for (let index = 0; index < TENTACLE_COUNT; index += 1) {
    const angle = (index / TENTACLE_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * RING_RADIUS;
    const z = Math.sin(angle) * RING_RADIUS;
    const sway = index % 2 ? WAVE : -WAVE;
    parts.push(
      limb([x, 0.8, z], [x + sway, 0.42, z], 0.05, armor, { roughness: 0.6, metalness: 0.1 }),
      limb([x + sway, 0.42, z], [x - sway, 0.04, z], 0.04, unit.color, { roughness: 0.6, metalness: 0.1 })
    );
  }
  return { parts, rifle: null };
}
