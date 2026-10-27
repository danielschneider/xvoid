import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { aliveCount, coneSpawns, createPool, mulberry32, spawn, step } from './particleSim.js';

const particleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Hard-edged square points with no antialiasing, matching the pixel-art look.
// vAlpha fades each particle out over its life so it does not pop when it dies.
const particleFragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, uOpacity * vAlpha);
  }
`;

// Pooled particles drawn as one THREE.Points. The pool is preallocated; each frame only
// live slots are written and the attributes are flagged for upload while anything is alive.
// Visual randomness comes from a mulberry32 PRNG seeded per instance.
export const Particles = forwardRef(function Particles({ capacity = 64, seed = 1, gravity = -6, opacity = 1 }, ref) {
  const gl = useThree((state) => state.gl);
  const pool = useMemo(() => createPool(capacity), [capacity]);
  const rng = useMemo(() => mulberry32(seed), [seed]);
  const sizes = useMemo(() => new Float32Array(capacity), [capacity]);
  const alphas = useMemo(() => new Float32Array(capacity), [capacity]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pool.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(pool.color, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    return geo;
  }, [pool, sizes, alphas]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: gl.getPixelRatio() },
          uOpacity: { value: opacity },
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gl, opacity]
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useImperativeHandle(
    ref,
    () => ({
      // Adds a list of spawns, e.g. from burstSpawns or coneSpawns.
      emitBurst(spawns) {
        for (const p of spawns) spawn(pool, p);
      },
      // Adds `count` particles in a cone around dir (unit {x,y,z}), using this instance's PRNG.
      emitCone(origin, dir, count, options) {
        for (const p of coneSpawns(rng, origin, dir, count, options)) spawn(pool, p);
      },
      alive() {
        return aliveCount(pool);
      },
    }),
    [pool, rng]
  );

  // Particles shrink and fade over their life; dead slots get size 0 so they vanish without a separate draw.
  const wasAlive = useRef(false);
  useFrame((_, delta) => {
    if (aliveCount(pool) === 0 && !wasAlive.current) return;
    step(pool, Math.min(delta, 0.05), gravity);
    for (let i = 0; i < pool.capacity; i += 1) {
      const ratio = pool.life[i] > 0 ? pool.life[i] / pool.maxLife[i] : 0;
      sizes[i] = pool.life[i] > 0 ? pool.size[i] * (0.4 + 0.6 * ratio) : 0;
      alphas[i] = Math.min(1, ratio * 2);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    wasAlive.current = aliveCount(pool) > 0;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={9} />;
});
