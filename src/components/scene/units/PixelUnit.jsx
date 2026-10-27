import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cellHeight, cellKey } from '../../../engine/map.js';
import { toWorld, toWorldY } from '../coords.js';
import { createCritTexture } from '../textures/labels.js';
import { advanceEffects, useEffectClock } from './UnitEffects.jsx';
import { UnitBody, applyBodyPose, moveBody } from './UnitBody.jsx';
import { updateSpriteView, useSpriteTextures } from './UnitSprite.jsx';

// Composition entry for one unit: wires refs, the shared frame loop and the three sub-parts.
export function PixelUnit({ unit, selected, targeted, shootable, hitChance, camera, movement, visibleCellKeys, lastShot }) {
  const refs = {
    group: useRef(),
    bodyGroup: useRef(),
    billboard: useRef(),
    sprite: useRef(),
    outline: useRef(),
    rifle: useRef(),
    muzzle: useRef(),
    muzzleMaterial: useRef(),
    critMaterial: useRef(),
    critOverlay: useRef(),
  };
  const clock = useEffectClock(unit, lastShot);
  const motion = {
    initialized: useRef(false),
    movementProgress: useRef({ id: null, elapsed: 0 }),
    routeStart: useMemo(() => new THREE.Vector3(), []),
    routeEnd: useMemo(() => new THREE.Vector3(), []),
  };
  const view = {
    spriteView: useRef(null),
    visualFacing: useRef(unit.facing ?? 0),
    cameraDirection: useMemo(() => new THREE.Vector3(), []),
  };
  const critTexture = useMemo(() => createCritTexture(), []);
  const spriteTextures = useSpriteTextures(unit.team, unit.color, unit.className);
  const ground = [toWorld(unit).x, toWorldY(unit) + 0.035, toWorld(unit).z];
  const destination = useMemo(() => new THREE.Vector3(...ground), [cellHeight(unit), unit.x, unit.z]);
  const fullRoute = movement?.unitId === unit.id ? movement.path : null;
  const firstVisibleIndex = unit.team === 'alien' && fullRoute
    ? fullRoute.findIndex((cell) => visibleCellKeys.has(cellKey(cell)))
    : 0;
  const route = fullRoute && firstVisibleIndex >= 0 ? fullRoute.slice(firstVisibleIndex) : null;
  const dead = unit.hp <= 0;
  const fallenOrientation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), []);
  useFrame((_, delta) => {
    const { recoil, pose } = advanceEffects(clock, { unitId: unit.id, dead, lastShot, refs }, delta);
    moveBody(refs, motion, { route, movement, destination }, delta);
    applyBodyPose(refs, { recoil, pose, facing: view.visualFacing.current, camera, fallenOrientation });
    if (refs.sprite.current) updateSpriteView(refs, view, spriteTextures, camera, unit.facing ?? 0, delta);
  });
  return (
    <UnitBody
      unit={unit}
      selected={selected}
      targeted={targeted}
      shootable={shootable}
      hitChance={hitChance}
      dead={dead}
      refs={refs}
      spriteTextures={spriteTextures}
      critTexture={critTexture}
    />
  );
}
