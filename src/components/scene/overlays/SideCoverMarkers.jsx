import { getSideCover } from '../../../engine/map.ts';
import { toWorld, toWorldY } from '../coords.js';
// Flat strips on the edge of a unit's cell, one per side that has cover.
// Full cover (wall/pillar) is blue, half cover (console) is green.
const SIDE_STRIPS = {
  N: { offset: [0, -0.44], size: [0.7, 0.1] },
  S: { offset: [0, 0.44], size: [0.7, 0.1] },
  E: { offset: [0.44, 0], size: [0.1, 0.7] },
  W: { offset: [-0.44, 0], size: [0.1, 0.7] },
};

export function SideCoverMarkers({ state, unit }) {
  const sides = getSideCover(state.map, unit);
  const base = [toWorld(unit).x, toWorldY(unit) + 0.07, toWorld(unit).z];
  return Object.entries(SIDE_STRIPS)
    .filter(([side]) => sides[side] > 0)
    .map(([side, { offset, size }]) => (
      <mesh key={side} position={[base[0] + offset[0], base[1], base[2] + offset[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial
          color={sides[side] === 2 ? '#8fd3ff' : '#a7e3b8'}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
    ));
}
