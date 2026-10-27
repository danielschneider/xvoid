import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
import { createDamageTexture } from '../textures/labels.js';
export function BeamEffect({ shot, camera }) {
  const line = useRef();
  const damageMaterial = useRef();
  const elapsed = useRef(0);
  const previousShake = useRef({ x: 0, y: 0 });
  const damageTexture = useMemo(() => createDamageTexture(shot), [shot.damage, shot.hit, shot.crit]);
  const from = shot.from;
  const to = shot.to;
  const animationDuration = shot.enemyShot ? 1.15 : 0.65;
  const points = [
    new THREE.Vector3(toWorld(from).x, toWorldY(from) + 0.8, toWorld(from).z),
    new THREE.Vector3(toWorld(to).x, toWorldY(to) + 0.8, toWorld(to).z),
  ];
  useFrame((_, delta) => {
    elapsed.current += delta;
    const opacity = Math.max(0, 1 - elapsed.current / animationDuration);
    if (line.current?.material) line.current.material.opacity = opacity;
    if (damageMaterial.current) damageMaterial.current.opacity = opacity;
    const shakeTime = Math.max(0, 0.16 - elapsed.current);
    const shake = shakeTime / 0.16;
    const nextShake = {
      x: Math.sin(elapsed.current * 88) * shake * (shot.hit ? 0.055 : 0.018),
      y: Math.cos(elapsed.current * 72) * shake * (shot.hit ? 0.04 : 0.012),
    };
    camera.position.x += nextShake.x - previousShake.current.x;
    camera.position.y += nextShake.y - previousShake.current.y;
    previousShake.current = nextShake;
  });
  return (
    <>
      <Line ref={line} points={points} color={shot.hit ? '#ff705f' : '#57d8ed'} lineWidth={2.2} transparent opacity={0.95} />
      {shot.hit && <pointLight position={points[1]} color="#ff664f" intensity={3} distance={3} decay={2} />}
      <mesh position={[points[1].x, points[1].y + 1.1, points[1].z]} quaternion={camera.quaternion} renderOrder={10}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshBasicMaterial ref={damageMaterial} map={damageTexture} transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
    </>
  );
}
