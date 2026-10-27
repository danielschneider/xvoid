import { useRef } from 'react';
import * as THREE from 'three';
import { critFrame, fallPose, fallStep, muzzleFrame, recoilAt } from './effectTiming.js';

// Per-unit effect clock: elapsed times since the last shot, the last shot ids that were played,
// and the fall progress (starts at 1 for a unit that is already dead).
export function useEffectClock(unit, lastShot) {
  const dead = unit.hp <= 0;
  return {
    critShotId: useRef(lastShot?.crit && lastShot.to.id === unit.id ? lastShot.id : null),
    critElapsed: useRef(Infinity),
    fireElapsed: useRef(Infinity),
    muzzleElapsed: useRef(Infinity),
    playedShotId: useRef(lastShot?.id ?? null),
    fall: useRef(dead ? 1 : 0),
  };
}

// Advances all shot and fall effects by delta. Returns the recoil envelope and fall pose for the body.
export function advanceEffects(clock, { unitId, dead, lastShot, refs }, delta) {
  if (lastShot && lastShot.from.id === unitId && lastShot.id !== clock.playedShotId.current) {
    clock.playedShotId.current = lastShot.id;
    clock.fireElapsed.current = 0;
    clock.muzzleElapsed.current = 0;
    if (refs.muzzle.current) refs.muzzle.current.rotation.z = Math.random() * Math.PI * 2;
  }
  if (lastShot && lastShot.crit && lastShot.to.id === unitId && lastShot.id !== clock.critShotId.current) {
    clock.critShotId.current = lastShot.id;
    clock.critElapsed.current = 0;
  }
  clock.fireElapsed.current += delta;
  clock.muzzleElapsed.current += delta;
  clock.critElapsed.current += delta;
  if (refs.critMaterial.current) {
    // Pops in, holds, then fades out over CRIT_DURATION.
    const crit = critFrame(clock.critElapsed.current);
    refs.critMaterial.current.opacity = crit.opacity;
    if (refs.critOverlay.current) {
      refs.critOverlay.current.visible = crit.visible;
      refs.critOverlay.current.scale.setScalar(crit.scale);
    }
  }
  // Recoil envelope: sharp kick at the shot, ease back to rest over FIRE_DURATION.
  const recoil = recoilAt(clock.fireElapsed.current);
  if (refs.rifle.current) {
    refs.rifle.current.position.set(0.28, 0.91 + recoil * 0.05, 0.16 - recoil * 0.12);
    refs.rifle.current.rotation.x = 0.12 - recoil * 0.35;
  }
  if (refs.muzzleMaterial.current && refs.muzzle.current) {
    const flash = muzzleFrame(clock.muzzleElapsed.current);
    refs.muzzle.current.visible = flash.visible;
    refs.muzzle.current.scale.setScalar(flash.scale);
    refs.muzzleMaterial.current.opacity = flash.opacity;
  }
  clock.fall.current = fallStep(clock.fall.current, dead, delta);
  return { recoil, pose: fallPose(clock.fall.current) };
}

export function CritOverlay({ refs, texture }) {
  const { critOverlay, critMaterial } = refs;
  return (
    <mesh ref={critOverlay} position={[0, 1.02, 0.05]} visible={false} renderOrder={12}>
      <planeGeometry args={[0.9, 0.45]} />
      <meshBasicMaterial ref={critMaterial} map={texture} transparent opacity={0} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function Muzzle({ refs }) {
  const { muzzle, muzzleMaterial } = refs;
  return (
    <mesh ref={muzzle} position={[0, 0, 0.5]} visible={false}>
      <planeGeometry args={[0.42, 0.42]} />
      <meshBasicMaterial ref={muzzleMaterial} color="#ffd27a" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}
