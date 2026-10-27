import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
import { buildFogLayers, getMapSpan } from './fogData.js';

// Lift above each floor's surface, same as the previous per-cell quads.
const FOG_LIFT = 0.026;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vCell;
  uniform float uSize;
  void main() {
    vUv = uv;
    vCell = uv * uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uTexel;
  varying vec2 vUv;
  varying vec2 vCell;

  // #080d0e as linear-agnostic sRGB values: ShaderMaterial output is not colour-converted here.
  const vec3 FOG_RGB = vec3(8.0, 13.0, 14.0) / 255.0;
  const float FOG_ALPHA = 0.9;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // 4-tap blur over roughly one cell so fog edges feather instead of stepping.
    float o = uTexel * 0.6;
    float hidden = 0.25 * (
      texture2D(uMap, vUv + vec2(-o, -o)).r +
      texture2D(uMap, vUv + vec2(o, -o)).r +
      texture2D(uMap, vUv + vec2(-o, o)).r +
      texture2D(uMap, vUv + vec2(o, o)).r
    );
    float fog = 1.0 - hidden;
    if (fog < 0.002) discard;

    // Low-frequency drift, applied only on the boundary band (peaks where fog is 0.5).
    float edge = 4.0 * fog * (1.0 - fog);
    vec2 drift = vec2(uTime * 0.045, -uTime * 0.03);
    float n = valueNoise(vCell * 0.35 + drift) * 0.6 + valueNoise(vCell * 0.8 - drift * 1.7) * 0.4;
    float alpha = FOG_ALPHA * fog + (n - 0.5) * 0.35 * edge;
    alpha = clamp(alpha, 0.0, FOG_ALPHA);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(FOG_RGB, alpha);
  }
`;

// One fog plane for one elevated level. Its texture holds one texel per (x, z) for that
// level only, so each fogged cell is fogged at its own floor height.
function FogLayer({ level, bytes, size }) {
  const texture = useMemo(() => {
    const tex = new THREE.DataTexture(bytes, size, size, THREE.RedFormat, THREE.UnsignedByteType);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [bytes, size]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: texture },
          uTime: { value: 0 },
          uSize: { value: size },
          uTexel: { value: 1 / size },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      }),
    [size, texture]
  );

  const geometry = useMemo(() => new THREE.PlaneGeometry(size, size), [size]);

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  // Plane centre in group-local space (same frame as toWorld). The plane spans the cell
  // edges, so the centre is the middle of the map: toWorld of cell (size - 1) / 2.
  const centre = toWorld({ x: (size - 1) / 2, z: (size - 1) / 2 });
  const y = toWorldY({ level }) + FOG_LIFT;

  return (
    <mesh
      position={[centre.x, y, centre.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      material={material}
      renderOrder={1}
    />
  );
}

export function FogOfWar({ cells, visibleCellKeys }) {
  const size = useMemo(() => getMapSpan(cells), [cells]);
  const layers = useMemo(
    () => (size === 0 ? [] : buildFogLayers(size, cells, visibleCellKeys)),
    [cells, visibleCellKeys, size]
  );

  return layers.map(({ level, bytes }) => (
    <FogLayer key={`fog-level-${level}`} level={level} bytes={bytes} size={size} />
  ));
}
