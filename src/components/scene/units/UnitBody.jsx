import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { toWorld, toWorldY } from '../coords.js';
import { Muzzle, CritOverlay } from './UnitEffects.jsx';
import { UnitSprite } from './UnitSprite.jsx';

// Static unit geometry: shadow, selection ring, body, rifle and billboard sprite group.
export function UnitBody({ unit, selected, targeted, shootable, hitChance, dead, refs, spriteTextures, critTexture }) {
  const armorColor = unit.team === 'alien' ? '#492b35' : '#324c43';
  return (
    <group ref={refs.group} name={`unit-${unit.id}`}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.35, 20]} />
        <meshBasicMaterial color="#020807" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {!dead && (selected || targeted || shootable) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
          <ringGeometry args={shootable && !targeted ? [0.48, 0.54, 32] : [0.42, 0.49, 32]} />
          <meshBasicMaterial
            color={targeted ? '#ff786d' : shootable ? '#f3bd76' : '#69e7ca'}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <group ref={refs.bodyGroup}>
        <mesh position={[0, 0.79, 0]}>
          <boxGeometry args={[0.48, 0.58, 0.32]} />
          <meshStandardMaterial color={armorColor} roughness={0.78} metalness={0.24} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.7, 0.2, 0.38]} />
          <meshStandardMaterial color={unit.color} roughness={0.68} metalness={0.28} />
        </mesh>
        <mesh position={[0, 1.31, 0]}>
          <boxGeometry args={[0.34, 0.34, 0.34]} />
          <meshStandardMaterial color="#b7b5a2" roughness={0.82} metalness={0.12} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.17, 0.31, 0]}>
            <boxGeometry args={[0.2, 0.42, 0.25]} />
            <meshStandardMaterial color="#242f2a" roughness={0.9} />
          </mesh>
        ))}
        <group ref={refs.rifle} position={[0.28, 0.91, 0.16]} rotation={[0.12, 0, -0.12]}>
          <mesh>
            <boxGeometry args={[0.14, 0.14, 0.5]} />
            <meshStandardMaterial color="#202722" roughness={0.55} metalness={0.52} />
          </mesh>
          <mesh position={[0, 0, 0.33]}>
            <boxGeometry args={[0.07, 0.07, 0.22]} />
            <meshStandardMaterial color="#a39a7d" roughness={0.42} metalness={0.62} />
          </mesh>
          <Muzzle refs={refs} />
        </group>
      </group>
      <group ref={refs.billboard} position={[0, 0.82, 0]}>
        <UnitSprite refs={refs} team={unit.team} spriteTextures={spriteTextures} />
        <CritOverlay refs={refs} texture={critTexture} />
      </group>
      {shootable && hitChance != null && (
        <Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="enemy-hit-chance">{hitChance}%</span>
        </Html>
      )}
    </group>
  );
}

// Walks the group along the route (or lerps to the destination when no route). Mutates motion progress only.
export function moveBody(refs, motion, { route, movement, destination }, delta) {
  if (!refs.group.current) return;
  if (!motion.initialized.current) {
    const first = route?.[0];
    if (first) refs.group.current.position.set(toWorld(first).x, toWorldY(first) + 0.035, toWorld(first).z);
    else refs.group.current.position.copy(destination);
    motion.initialized.current = true;
  }
  if (route?.length > 1) {
    if (motion.movementProgress.current.id !== movement.id)
      motion.movementProgress.current = { id: movement.id, elapsed: 0 };
    motion.movementProgress.current.elapsed += delta;
    const progress = Math.min(motion.movementProgress.current.elapsed / 0.22, route.length - 1);
    const segment = Math.min(Math.floor(progress), route.length - 2);
    const segmentProgress = progress >= route.length - 1 ? 1 : progress - segment;
    const from = route[segment];
    const to = route[segment + 1];
    motion.routeStart.set(toWorld(from).x, toWorldY(from) + 0.035, toWorld(from).z);
    motion.routeEnd.set(toWorld(to).x, toWorldY(to) + 0.035, toWorld(to).z);
    refs.group.current.position.lerpVectors(motion.routeStart, motion.routeEnd, segmentProgress);
  } else {
    refs.group.current.position.lerp(destination, 0.12);
  }
}

// Applies facing, fall tilt and recoil to the body, and the billboard orientation and height.
export function applyBodyPose(refs, { recoil, pose, facing, camera, fallenOrientation }) {
  if (refs.bodyGroup.current) {
    refs.bodyGroup.current.rotation.y = facing;
    refs.bodyGroup.current.rotation.x = (-Math.PI / 2) * pose;
    // Body rocks back slightly when firing; pushed along local -z (away from the aim direction).
    refs.bodyGroup.current.position.z = -recoil * 0.08 * (1 - pose);
  }
  if (refs.billboard.current) {
    refs.billboard.current.quaternion.copy(camera.quaternion);
    if (pose > 0) refs.billboard.current.quaternion.slerp(fallenOrientation, pose);
    refs.billboard.current.position.y = THREE.MathUtils.lerp(0.82, 0.05, pose);
  }
}
