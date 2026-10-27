import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { cellKey } from '../../../engine/map.js';
import { toWorld, toWorldY } from '../coords.js';
import { createTileTexture } from '../textures/tiles.js';
import { ROGUELIKE_SHEET } from './sheet.js';
export function CoverField({ cells, selected }) {
  const atlas = useLoader(THREE.TextureLoader, ROGUELIKE_SHEET);
  const stoneTexture = useMemo(() => createTileTexture(atlas.image, 5, 14), [atlas]);
  const earthTexture = useMemo(() => createTileTexture(atlas.image, 5, 8), [atlas]);
  const data = useMemo(() => cells.filter((cell) => cell.terrain === 'console' || cell.terrain === 'pillar'), [cells]);
  return data.map((cell) => {
    const height = cell.terrain === 'pillar' ? 1.14 : 0.46;
    const position = [toWorld(cell).x, toWorldY(cell) + height / 2, toWorld(cell).z];
    return (
      <group key={cellKey(cell)} position={position}>
        <mesh position={[0, -height / 2 + 0.045, 0]}>
          <boxGeometry args={cell.terrain === 'pillar' ? [0.72, 0.09, 0.72] : [0.88, 0.09, 0.62]} />
          <meshStandardMaterial color="#303d39" roughness={0.82} metalness={0.32} />
        </mesh>
        <mesh castShadow={false}>
          <boxGeometry args={cell.terrain === 'pillar' ? [0.64, height, 0.64] : [0.82, height, 0.56]} />
          <meshStandardMaterial map={cell.terrain === 'pillar' ? stoneTexture : earthTexture} color="#ffffff" roughness={0.94} flatShading />
        </mesh>
        <mesh position={[0, height * 0.14, cell.terrain === 'pillar' ? 0.331 : 0.29]}>
          <boxGeometry args={cell.terrain === 'pillar' ? [0.34, 0.48, 0.035] : [0.54, 0.17, 0.035]} />
          <meshStandardMaterial color="#263632" roughness={0.58} metalness={0.52} />
        </mesh>
        <mesh position={[0, height * 0.14, cell.terrain === 'pillar' ? 0.351 : 0.31]}>
          <boxGeometry args={[cell.terrain === 'pillar' ? 0.24 : 0.4, 0.035, 0.012]} />
          <meshBasicMaterial color={selected ? '#54dfc1' : '#83bfa2'} />
        </mesh>
        <mesh position={[0, height / 2 + 0.012, 0]}>
          <boxGeometry args={[0.68, 0.025, 0.6]} />
          <meshBasicMaterial color={selected ? '#54dfc1' : '#9cd2bd'} />
        </mesh>
        {cell.terrain === 'pillar' && <mesh position={[0, height / 2 - 0.055, 0]}><boxGeometry args={[0.72, 0.055, 0.72]} /><meshStandardMaterial color="#849087" roughness={0.52} metalness={0.48} /></mesh>}
      </group>
    );
  });
}
