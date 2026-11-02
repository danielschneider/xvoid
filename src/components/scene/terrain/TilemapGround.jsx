import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildGroundData } from './groundData.js';
import { GRASS_DEFAULTS, GRASS_FRAGMENT, GRASS_VERTEX } from './grassShader.js';

// Procedural grass ground: one RGBA DataTexture (one texel per cell) drives a ShaderMaterial.
function useGroundTexture(map, visibleCellKeys, exploredCellKeys) {
  const texture = useMemo(() => {
    const { data, width, height } = buildGroundData(map, visibleCellKeys, exploredCellKeys);
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [map, visibleCellKeys, exploredCellKeys]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function useGrassMaterial(texture, map) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCells: { value: texture },
          uSize: { value: map.size },
          uSeed: { value: map.seed | 0 },
          uBase: { value: new THREE.Vector3(...GRASS_DEFAULTS.base) },
          uDotLight: { value: new THREE.Vector3(...GRASS_DEFAULTS.dotLight) },
          uDotDark: { value: new THREE.Vector3(...GRASS_DEFAULTS.dotDark) },
          uStructure: { value: new THREE.Vector3(...GRASS_DEFAULTS.structure) },
          uFog: { value: new THREE.Vector3(...GRASS_DEFAULTS.fog) },
          uFogAlpha: { value: GRASS_DEFAULTS.fogAlpha },
        },
        vertexShader: GRASS_VERTEX,
        fragmentShader: GRASS_FRAGMENT,
        toneMapped: false,
      }),
    [texture, map.size, map.seed]
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

export function TilemapGround({ map, visibleCellKeys, exploredCellKeys }) {
  const texture = useGroundTexture(map, visibleCellKeys, exploredCellKeys);
  const material = useGrassMaterial(texture, map);

  return (
    <>
      {/* Solid underlay: any pixel the textured plane misses shows tile color, not the scene background. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[map.size + 0.1, map.size + 0.1]} />
        <meshBasicMaterial color="#202b2b" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} material={material}>
        <planeGeometry args={[map.size, map.size]} />
      </mesh>
    </>
  );
}
