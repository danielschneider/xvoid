import { useMemo } from 'react';
import * as THREE from 'three';
import { createSpriteTexture } from '../textures/sprites.js';
import { angleDelta, selectSpriteView } from './spriteView.js';

export function useSpriteTextures(team, color, className, model) {
  return useMemo(
    () =>
      Object.fromEntries(
        ['front', 'right', 'back', 'left'].map((view) => [
          view,
          createSpriteTexture(team, color, className, view, model),
        ])
      ),
    [team, color, className, model]
  );
}

// Outline and sprite planes inside the billboard group.
export function UnitSprite({ refs, team, spriteTextures }) {
  const { outline, sprite } = refs;
  return (
    <>
      <mesh ref={outline} scale={[1.16, 1.14, 1]} position={[0, 0, -0.015]}>
        <planeGeometry args={[0.92, 1.38]} />
        <meshBasicMaterial
          map={spriteTextures.front}
          color={team === 'alien' ? '#29151c' : '#10231e'}
          transparent
          alphaTest={0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={sprite}>
        <planeGeometry args={[1.06, 1.52]} />
        <meshBasicMaterial
          map={spriteTextures.front}
          transparent
          alphaTest={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

// Turns the unit towards its facing, picks the view relative to the camera and swaps the textures on change.
export function updateSpriteView(refs, state, spriteTextures, camera, desiredFacing, delta) {
  const { spriteView, visualFacing, cameraDirection } = state;
  camera.getWorldDirection(cameraDirection);
  const cameraFacing = Math.atan2(-cameraDirection.x, -cameraDirection.z);
  const turnDelta = angleDelta(desiredFacing - visualFacing.current);
  visualFacing.current += turnDelta * Math.min(1, delta * 7);
  const relativeFacing = angleDelta(visualFacing.current - cameraFacing);
  const view = selectSpriteView(relativeFacing);
  if (spriteView.current !== view) {
    refs.sprite.current.material.map = spriteTextures[view];
    refs.sprite.current.material.needsUpdate = true;
    refs.outline.current.material.map = spriteTextures[view];
    refs.outline.current.material.needsUpdate = true;
    spriteView.current = view;
  }
}
