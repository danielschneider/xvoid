import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { cellKey } from '../../../engine/map.js';
import { toWorld, toWorldY } from '../coords.js';
// Flat shield glyph lying on the ground, centred on the cell (shape Y maps to world -Z).
const SHIELD_GEOMETRY = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.17, 0.2);
  shape.lineTo(0.17, 0.2);
  shape.lineTo(0.17, 0.02);
  shape.quadraticCurveTo(0.17, -0.14, 0, -0.22);
  shape.quadraticCurveTo(-0.17, -0.14, -0.17, 0.02);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();
const SHIELD_COLOR = { 1: '#ffd34d', 2: '#7fe08a' };

export function ReachableOverlay({ paths, map, coverProfiles }) {
  const entries = useMemo(
    () =>
      [...paths.entries()].map(([key, value]) => {
        const cell = map.cells[key];
        const x = toWorld(cell).x;
        const z = toWorld(cell).z;
        const y = toWorldY(cell) + 0.026;
        return {
          cell,
          ...value,
          outline: [
            new THREE.Vector3(x - 0.45, y, z - 0.45),
            new THREE.Vector3(x + 0.45, y, z - 0.45),
            new THREE.Vector3(x + 0.45, y, z + 0.45),
            new THREE.Vector3(x - 0.45, y, z + 0.45),
            new THREE.Vector3(x - 0.45, y, z - 0.45),
          ],
        };
      }),
    [map, paths]
  );
  return entries.map(({ cell, apCost, steps, outline }) => {
    // Tile color is the AP cost (cyan = 1 AP, orange = 2 AP). Cover on that cell is a separate inner marker.
    const color = apCost === 1 ? '#00cfff' : '#ffc247';
    const tier = coverProfiles?.get(cellKey(cell))?.tier ?? 0;
    const y = toWorldY(cell);
    return (
      <group key={cellKey(cell)}>
        <mesh position={[toWorld(cell).x, y + 0.018, toWorld(cell).z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.86, 0.86]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={steps <= 5 ? 0.4 : 0.5}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {tier > 0 && (
          <mesh
            geometry={SHIELD_GEOMETRY}
            position={[toWorld(cell).x, y + 0.024, toWorld(cell).z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshBasicMaterial
              color={SHIELD_COLOR[tier]}
              transparent
              opacity={0.95}
              depthWrite={false}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
        <Line points={outline} color={color} lineWidth={1.2} transparent opacity={0.95} />
      </group>
    );
  });
}
