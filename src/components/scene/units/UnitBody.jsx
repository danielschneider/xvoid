import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { CritOverlay, Muzzle } from './UnitEffects.jsx';
import { UnitSprite } from './UnitSprite.jsx';
import { FootCircle } from './FootCircle.jsx';
import { BodyParts } from './BodyParts.jsx';
import { TargetCross } from './TargetCross.jsx';
import { buildBody } from './bodyModels.js';
export { moveBody, applyBodyPose } from './bodyPose.js';

// Static unit geometry: shadow, selection ring, model body, rifle (if the model has one) and billboard sprite group.
export function UnitBody({
  unit,
  selected,
  targeted,
  shootable,
  hitChance,
  dead,
  bodyHidden,
  refs,
  spriteTextures,
  critTexture,
}) {
  const pulsing = !dead && selected && unit.team === 'player';
  const body = useMemo(() => buildBody(unit.model, unit), [unit.model, unit.team, unit.color]);
  return (
    // Hidden bodies keep the named group mounted, so camera tracking still follows the movement.
    <group ref={refs.group} name={`unit-${unit.id}`} visible={!bodyHidden}>
      {!pulsing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <circleGeometry args={[0.35, 20]} />
          <meshBasicMaterial color="#020807" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {pulsing && <FootCircle color="#ff2a1f" />}
      {!dead && (selected || targeted || shootable) && !targeted && !pulsing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
          <ringGeometry args={shootable ? [0.48, 0.54, 32] : [0.42, 0.49, 32]} />
          <meshBasicMaterial
            color={shootable ? '#f3bd76' : '#69e7ca'}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <group ref={refs.bodyGroup} position={[0, body.groundY, 0]} scale={body.scale}>
        <BodyParts parts={body.parts} />
        {body.rifle && (
          <group ref={refs.rifle} position={body.rifle.position} rotation={body.rifle.rotation}>
            <BodyParts parts={body.rifle.parts} />
            <Muzzle refs={refs} />
          </group>
        )}
      </group>
      <group ref={refs.billboard} position={[0, body.spriteY, 0]} scale={body.scale}>
        <UnitSprite refs={refs} team={unit.team} spriteTextures={spriteTextures} />
        <CritOverlay refs={refs} texture={critTexture} />
        {!dead && targeted && <TargetCross />}
      </group>
      {shootable && hitChance != null && (
        <Html position={[0, body.labelY, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="enemy-hit-chance">{hitChance}%</span>
        </Html>
      )}
    </group>
  );
}
