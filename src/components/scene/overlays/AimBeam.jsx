import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
export function AimBeam({ shooter, target, blocked }) {
  const points = useMemo(
    () => [shooter, target].map((unit) => new THREE.Vector3(toWorld(unit).x, toWorldY(unit) + 0.82, toWorld(unit).z)),
    [shooter, target]
  );
  const color = blocked ? '#ffd27a' : '#ff4d42';
  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={9}
        transparent
        opacity={0.35}
        depthTest={false}
        renderOrder={998}
      />
      <Line
        points={points}
        color="#ffffff"
        lineWidth={3}
        transparent
        opacity={0.95}
        depthTest={false}
        renderOrder={999}
      />
      <Line points={points} color={color} lineWidth={5} transparent opacity={1} depthTest={false} renderOrder={999} />
    </group>
  );
}
