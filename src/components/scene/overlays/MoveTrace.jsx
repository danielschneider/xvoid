import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
export function MoveTrace({ path, start }) {
  const points = useMemo(() => [start, ...path].map((cell) => (
    new THREE.Vector3(toWorld(cell).x, toWorldY(cell) + 0.055, toWorld(cell).z)
  )), [path, start]);
  return <Line points={points} color="#d7f279" lineWidth={4} transparent opacity={0.95} />;
}
