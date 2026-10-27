import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { createGroundTexture } from '../textures/tiles.js';
import { ROGUELIKE_SHEET } from './sheet.js';
export function TilemapGround({ map, visibleCellKeys }) {
  const atlas = useLoader(THREE.TextureLoader, ROGUELIKE_SHEET);
  const texture = useMemo(() => createGroundTexture(atlas.image, map, visibleCellKeys), [atlas, map, visibleCellKeys]);

  return (
    <>
      {/* Solid underlay: any pixel the textured plane misses shows tile color, not the scene background. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[map.size + 0.1, map.size + 0.1]} />
        <meshBasicMaterial color="#202b2b" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[map.size, map.size]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </>
  );
}
