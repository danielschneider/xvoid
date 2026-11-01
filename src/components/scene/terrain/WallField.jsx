import { useMemo } from 'react';
import { cellKey } from '../../../engine/map.ts';
import { toWorld } from '../coords.js';
import { createWallTexture } from '../textures/procedural/wallTexture.js';
export function WallField({ cells, selected, mapSeed }) {
  const wallTexture = useMemo(() => createWallTexture(mapSeed), [mapSeed]);
  return cells
    .filter((cell) => cell.terrain === 'wall')
    .map((cell) => {
      const nearby = selected && Math.hypot(selected.x - cell.x, selected.z - cell.z) < 5;
      return (
        <group key={cellKey(cell)} position={[toWorld(cell).x, 0.74, toWorld(cell).z]}>
          <mesh>
            <boxGeometry args={[0.92, 1.42, 0.92]} />
            <meshStandardMaterial
              map={wallTexture}
              color="#ffffff"
              roughness={0.94}
              transparent={nearby}
              opacity={nearby ? 0.34 : 1}
            />
          </mesh>
          <mesh position={[0, -0.57, 0]}>
            <boxGeometry args={[1, 0.2, 1]} />
            <meshStandardMaterial
              color="#394942"
              roughness={0.7}
              metalness={0.42}
              transparent={nearby}
              opacity={nearby ? 0.34 : 1}
            />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[1.02, 0.12, 1.02]} />
            <meshStandardMaterial
              color="#859087"
              roughness={0.52}
              metalness={0.48}
              transparent={nearby}
              opacity={nearby ? 0.34 : 1}
            />
          </mesh>
          <mesh position={[-0.37, 0.03, 0.473]}>
            <boxGeometry args={[0.055, 1.05, 0.035]} />
            <meshStandardMaterial
              color="#829087"
              roughness={0.58}
              metalness={0.52}
              transparent={nearby}
              opacity={nearby ? 0.34 : 1}
            />
          </mesh>
          <mesh position={[0.37, 0.03, 0.473]}>
            <boxGeometry args={[0.055, 1.05, 0.035]} />
            <meshStandardMaterial
              color="#829087"
              roughness={0.58}
              metalness={0.52}
              transparent={nearby}
              opacity={nearby ? 0.34 : 1}
            />
          </mesh>
        </group>
      );
    });
}
