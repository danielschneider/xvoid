import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { getFlankedBy } from '../engine/game.js';
import { cellHeight, cellKey, getSideCover, hasLineOfSight } from '../engine/map.js';
import { CELL_OFFSET, STEP_HEIGHT, toWorld, toWorldY } from './scene/coords.js';
import { createTileTexture, createGroundTexture } from './scene/textures/tiles.js';
import { createSpriteTexture } from './scene/textures/sprites.js';
import { createCritTexture, createDamageTexture } from './scene/textures/labels.js';
const ROGUELIKE_SHEET = `${import.meta.env.BASE_URL}assets/kenney-roguelike/Spritesheet/roguelikeSheet_transparent.png`;

function TilemapGround({ map, visibleCellKeys }) {
  const atlas = useLoader(THREE.TextureLoader, ROGUELIKE_SHEET);
  const texture = useMemo(() => createGroundTexture(atlas.image, map, visibleCellKeys), [atlas, map, visibleCellKeys]);

  return (
    <>
      {/* Solid underlay: any pixel the textured plane misses shows tile color, not the scene background. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[map.size + 0.1, map.size + 0.1]} />
        <meshBasicMaterial color="#202b2b" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[map.size, map.size]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </>
  );
}

function InstancedGround({ cells, visibleCells, meshRef }) {
  const data = useMemo(() => visibleCells.filter((cell) => cell.walkable), [visibleCells]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0.12 }), []);

  useEffect(() => {
    if (!meshRef.current) return;
    data.forEach((cell, index) => {
      dummy.position.set(toWorld(cell).x, toWorldY(cell) - 0.08, toWorld(cell).z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
      const color = cell.level === 0
        ? (cell.corridor ? '#263332' : cell.structure ? '#303c39' : '#202b2b')
        : cell.level === 1 ? '#52605a' : '#6d7568';
      meshRef.current.setColorAt(index, new THREE.Color(color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    // Raycasts use the bounding sphere; recompute it so taps on the instances are not culled.
    meshRef.current.computeBoundingSphere();
  }, [data, dummy, meshRef]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, material, data.length]} receiveShadow={false}>
      <boxGeometry args={[1.02, 0.16, 1.02]} />
    </instancedMesh>
  );
}

function CoverField({ cells, selected }) {
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

function WallField({ cells, selected }) {
  const atlas = useLoader(THREE.TextureLoader, ROGUELIKE_SHEET);
  const wallTexture = useMemo(() => createTileTexture(atlas.image, 13, 27), [atlas]);
  return cells.filter((cell) => cell.terrain === 'wall').map((cell) => {
    const nearby = selected && Math.hypot(selected.x - cell.x, selected.z - cell.z) < 5;
    return (
      <group key={cellKey(cell)} position={[toWorld(cell).x, 0.74, toWorld(cell).z]}>
        <mesh>
          <boxGeometry args={[0.92, 1.42, 0.92]} />
          <meshStandardMaterial map={wallTexture} color="#ffffff" roughness={0.94} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
        <mesh position={[0, -0.57, 0]}>
          <boxGeometry args={[1, 0.2, 1]} />
          <meshStandardMaterial color="#394942" roughness={0.7} metalness={0.42} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[1.02, 0.12, 1.02]} />
          <meshStandardMaterial color="#859087" roughness={0.52} metalness={0.48} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
        <mesh position={[0, 0.08, 0.466]}>
          <boxGeometry args={[0.56, 0.68, 0.025]} />
          <meshStandardMaterial color="#334741" roughness={0.62} metalness={0.38} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
        <mesh position={[0, 0.08, 0.482]}>
          <boxGeometry args={[0.32, 0.055, 0.012]} />
          <meshBasicMaterial color={nearby ? '#315a4e' : '#76b99a'} />
        </mesh>
        <mesh position={[0.466, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.56, 0.68, 0.025]} />
          <meshStandardMaterial color="#334741" roughness={0.62} metalness={0.38} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
        <mesh position={[0.482, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.32, 0.055, 0.012]} />
          <meshBasicMaterial color={nearby ? '#315a4e' : '#76b99a'} />
        </mesh>
        <mesh position={[-0.37, 0.03, 0.473]}>
          <boxGeometry args={[0.055, 1.05, 0.035]} />
          <meshStandardMaterial color="#829087" roughness={0.58} metalness={0.52} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
        <mesh position={[0.37, 0.03, 0.473]}>
          <boxGeometry args={[0.055, 1.05, 0.035]} />
          <meshStandardMaterial color="#829087" roughness={0.58} metalness={0.52} transparent={nearby} opacity={nearby ? 0.34 : 1} />
        </mesh>
      </group>
    );
  });
}

// Flat shield glyph lying on the ground, centred on the cell (shape Y maps to world -Z).
const SHIELD_GEOMETRY = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.17, 0.2);
  shape.lineTo(0.17, 0.2);
  shape.lineTo(0.17, 0.02);
  shape.quadraticCurveTo(0.17, -0.14, 0, -0.22);
  shape.quadraticCurveTo(-0.17, -0.14, -0.17, 0.02);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();
const SHIELD_COLOR = { 1: '#ffd34d', 2: '#7fe08a' };

function ReachableOverlay({ paths, map, coverProfiles }) {
  const entries = useMemo(() => [...paths.entries()].map(([key, value]) => {
    const cell = map.cells[key];
    const x = toWorld(cell).x;
    const z = toWorld(cell).z;
    const y = toWorldY(cell) + 0.026;
    return {
      cell,
      ...value,
      outline: [
        new THREE.Vector3(x - 0.45, y, z - 0.45),
        new THREE.Vector3(x + 0.45, y, z - 0.45),
        new THREE.Vector3(x + 0.45, y, z + 0.45),
        new THREE.Vector3(x - 0.45, y, z + 0.45),
        new THREE.Vector3(x - 0.45, y, z - 0.45),
      ],
    };
  }), [map, paths]);
  return entries.map(({ cell, apCost, steps, outline }) => {
    // Tile color is the AP cost (cyan = 1 AP, orange = 2 AP). Cover on that cell is a separate inner marker.
    const color = apCost === 1 ? '#00cfff' : '#ffc247';
    const tier = coverProfiles?.get(cellKey(cell))?.tier ?? 0;
    const y = toWorldY(cell);
    return (
      <group key={cellKey(cell)}>
        <mesh position={[toWorld(cell).x, y + 0.018, toWorld(cell).z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.86, 0.86]} />
          <meshBasicMaterial color={color} transparent opacity={steps <= 5 ? 0.4 : 0.5} depthWrite={false} toneMapped={false} />
        </mesh>
        {tier > 0 && (
          <mesh geometry={SHIELD_GEOMETRY} position={[toWorld(cell).x, y + 0.024, toWorld(cell).z]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={SHIELD_COLOR[tier]} transparent opacity={0.95} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        )}
        <Line points={outline} color={color} lineWidth={1.2} transparent opacity={0.95} />
      </group>
    );
  });
}

function MoveTrace({ path, start }) {
  const points = useMemo(() => [start, ...path].map((cell) => (
    new THREE.Vector3(toWorld(cell).x, toWorldY(cell) + 0.055, toWorld(cell).z)
  )), [path, start]);
  return <Line points={points} color="#d7f279" lineWidth={4} transparent opacity={0.95} />;
}

function AimBeam({ shooter, target, blocked }) {
  const points = useMemo(() => [shooter, target].map((unit) => (
    new THREE.Vector3(toWorld(unit).x, toWorldY(unit) + 0.82, toWorld(unit).z)
  )), [shooter, target]);
  const color = blocked ? '#ffd27a' : '#ff4d42';
  return (
    <group>
      <Line points={points} color={color} lineWidth={9} transparent opacity={0.35} depthTest={false} renderOrder={998} />
      <Line points={points} color="#ffffff" lineWidth={3} transparent opacity={0.95} depthTest={false} renderOrder={999} />
      <Line points={points} color={color} lineWidth={5} transparent opacity={1} depthTest={false} renderOrder={999} />
    </group>
  );
}

// Flat strips on the edge of a unit's cell, one per side that has cover.
// Full cover (wall/pillar) is blue, half cover (console) is green.
const SIDE_STRIPS = {
  N: { offset: [0, -0.44], size: [0.7, 0.1] },
  S: { offset: [0, 0.44], size: [0.7, 0.1] },
  E: { offset: [0.44, 0], size: [0.1, 0.7] },
  W: { offset: [-0.44, 0], size: [0.1, 0.7] },
};

function SideCoverMarkers({ state, unit }) {
  const sides = getSideCover(state.map, unit);
  const base = [toWorld(unit).x, toWorldY(unit) + 0.07, toWorld(unit).z];
  return Object.entries(SIDE_STRIPS).filter(([side]) => sides[side] > 0).map(([side, { offset, size }]) => (
    <mesh key={side} position={[base[0] + offset[0], base[1], base[2] + offset[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={sides[side] === 2 ? '#8fd3ff' : '#a7e3b8'} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  ));
}

// Red lines from every enemy that flanks a player unit to that unit.
function FlankLines({ state, visibleCellKeys }) {
  const pairs = useMemo(() => state.units
    .filter((unit) => unit.team === 'player' && unit.hp > 0)
    .flatMap((unit) => getFlankedBy(state, unit)
      .filter((enemy) => visibleCellKeys.has(cellKey(enemy)))
      .map((enemy) => ({ key: `${unit.id}-${enemy.id}`, from: enemy, to: unit }))), [state, visibleCellKeys]);
  return pairs.map(({ key, from, to }) => {
    const points = [from, to].map((cell) => new THREE.Vector3(toWorld(cell).x, toWorldY(cell) + 0.9, toWorld(cell).z));
    return <Line key={key} points={points} color="#ff4d42" lineWidth={3} dashed dashSize={0.25} gapSize={0.15} depthTest={false} renderOrder={997} />;
  });
}

function FogOfWar({ cells, visibleCellKeys }) {
  const foggedCells = useMemo(() => cells.filter((cell) => cell.level > 0 && !visibleCellKeys.has(cellKey(cell))), [cells, visibleCellKeys]);
  return foggedCells.map((cell) => (
    <mesh key={`fog-${cellKey(cell)}`} position={[toWorld(cell).x, toWorldY(cell) + 0.026, toWorld(cell).z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#080d0e" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  ));
}

const FIRE_DURATION = 0.3;
const MUZZLE_DURATION = 0.08;
const CRIT_DURATION = 0.9;

function PixelUnit({ unit, selected, targeted, shootable, hitChance, camera, movement, visibleCellKeys, lastShot }) {
  const group = useRef();
  const bodyGroup = useRef();
  const billboard = useRef();
  const sprite = useRef();
  const outline = useRef();
  const rifle = useRef();
  const muzzle = useRef();
  const muzzleMaterial = useRef();
  const critMaterial = useRef();
  const critOverlay = useRef();
  const critShotId = useRef(lastShot?.crit && lastShot.to.id === unit.id ? lastShot.id : null);
  const critElapsed = useRef(Infinity);
  const fireElapsed = useRef(Infinity);
  const muzzleElapsed = useRef(Infinity);
  const playedShotId = useRef(lastShot?.id ?? null);
  const movementProgress = useRef({ id: null, elapsed: 0 });
  const critTexture = useMemo(() => createCritTexture(), []);
  const routeStart = useMemo(() => new THREE.Vector3(), []);
  const routeEnd = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const armorColor = unit.team === 'alien' ? '#492b35' : '#324c43';
  const spriteTextures = useMemo(() => Object.fromEntries(
    ['front', 'right', 'back', 'left'].map((view) => [view, createSpriteTexture(unit.team, unit.color, unit.className, view)]),
  ), [unit.team, unit.color, unit.className]);
  const spriteView = useRef(null);
  const visualFacing = useRef(unit.facing ?? 0);
  const ground = [toWorld(unit).x, toWorldY(unit) + 0.035, toWorld(unit).z];
  const destination = useMemo(() => new THREE.Vector3(...ground), [cellHeight(unit), unit.x, unit.z]);
  const fullRoute = movement?.unitId === unit.id ? movement.path : null;
  const firstVisibleIndex = unit.team === 'alien' && fullRoute
    ? fullRoute.findIndex((cell) => visibleCellKeys.has(cellKey(cell)))
    : 0;
  const route = fullRoute && firstVisibleIndex >= 0 ? fullRoute.slice(firstVisibleIndex) : null;
  const initialized = useRef(false);
  const dead = unit.hp <= 0;
  // 0 = standing, 1 = fully lying on the ground. Animates when the unit dies.
  const fall = useRef(dead ? 1 : 0);
  const fallenOrientation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), []);
  useFrame((_, delta) => {
    if (lastShot && lastShot.from.id === unit.id && lastShot.id !== playedShotId.current) {
      playedShotId.current = lastShot.id;
      fireElapsed.current = 0;
      muzzleElapsed.current = 0;
      if (muzzle.current) muzzle.current.rotation.z = Math.random() * Math.PI * 2;
    }
    if (lastShot && lastShot.crit && lastShot.to.id === unit.id && lastShot.id !== critShotId.current) {
      critShotId.current = lastShot.id;
      critElapsed.current = 0;
    }
    fireElapsed.current += delta;
    muzzleElapsed.current += delta;
    critElapsed.current += delta;
    if (critMaterial.current) {
      // Pops in, holds, then fades out over CRIT_DURATION.
      const critT = critElapsed.current / CRIT_DURATION;
      const critVisible = critT < 1;
      critMaterial.current.opacity = critVisible ? Math.min(1, critT * 6) * (1 - Math.max(0, critT - 0.6) / 0.4) : 0;
      if (critOverlay.current) {
        critOverlay.current.visible = critVisible;
        critOverlay.current.scale.setScalar(1 + Math.max(0, 0.35 - critT) * 1.5);
      }
    }
    // Recoil envelope: sharp kick at the shot, ease back to rest over FIRE_DURATION.
    const fireT = Math.min(1, fireElapsed.current / FIRE_DURATION);
    const recoil = fireT < 1 ? Math.sin(Math.PI * fireT) * (1 - fireT * 0.5) : 0;
    if (rifle.current) {
      rifle.current.position.set(0.28, 0.91 + recoil * 0.05, 0.16 - recoil * 0.12);
      rifle.current.rotation.x = 0.12 - recoil * 0.35;
    }
    if (muzzleMaterial.current && muzzle.current) {
      const flashT = muzzleElapsed.current / MUZZLE_DURATION;
      const flash = Math.max(0, 1 - flashT);
      muzzle.current.visible = flash > 0;
      muzzle.current.scale.setScalar(0.6 + flash * 0.6);
      muzzleMaterial.current.opacity = flash;
    }
    fall.current = dead ? Math.min(1, fall.current + delta * 2.5) : 0;
    const pose = fall.current * fall.current * (3 - 2 * fall.current);
    if (group.current) {
      if (!initialized.current) {
        const first = route?.[0];
        if (first) group.current.position.set(toWorld(first).x, toWorldY(first) + 0.035, toWorld(first).z);
        else group.current.position.copy(destination);
        initialized.current = true;
      }
      if (route?.length > 1) {
        if (movementProgress.current.id !== movement.id) movementProgress.current = { id: movement.id, elapsed: 0 };
        movementProgress.current.elapsed += delta;
        const progress = Math.min(movementProgress.current.elapsed / 0.22, route.length - 1);
        const segment = Math.min(Math.floor(progress), route.length - 2);
        const segmentProgress = progress >= route.length - 1 ? 1 : progress - segment;
        const from = route[segment];
        const to = route[segment + 1];
        routeStart.set(toWorld(from).x, toWorldY(from) + 0.035, toWorld(from).z);
        routeEnd.set(toWorld(to).x, toWorldY(to) + 0.035, toWorld(to).z);
        group.current.position.lerpVectors(routeStart, routeEnd, segmentProgress);
      } else {
        group.current.position.lerp(destination, 0.12);
      }
    }
    if (bodyGroup.current) {
      bodyGroup.current.rotation.y = visualFacing.current;
      bodyGroup.current.rotation.x = -Math.PI / 2 * pose;
      // Body rocks back slightly when firing; pushed along local -z (away from the aim direction).
      bodyGroup.current.position.z = -recoil * 0.08 * (1 - pose);
    }
    if (billboard.current) {
      billboard.current.quaternion.copy(camera.quaternion);
      if (pose > 0) billboard.current.quaternion.slerp(fallenOrientation, pose);
      billboard.current.position.y = THREE.MathUtils.lerp(0.82, 0.05, pose);
    }
    if (sprite.current) {
      camera.getWorldDirection(cameraDirection);
      const cameraFacing = Math.atan2(-cameraDirection.x, -cameraDirection.z);
      const desiredFacing = unit.facing ?? 0;
      const turnDelta = Math.atan2(Math.sin(desiredFacing - visualFacing.current), Math.cos(desiredFacing - visualFacing.current));
      visualFacing.current += turnDelta * Math.min(1, delta * 7);
      const relativeFacing = Math.atan2(
        Math.sin(visualFacing.current - cameraFacing),
        Math.cos(visualFacing.current - cameraFacing),
      );
      const view = Math.abs(relativeFacing) < Math.PI / 4
        ? 'front'
        : Math.abs(relativeFacing) > Math.PI * 3 / 4
          ? 'back'
          : relativeFacing > 0 ? 'right' : 'left';
      if (spriteView.current !== view) {
        sprite.current.material.map = spriteTextures[view];
        sprite.current.material.needsUpdate = true;
        outline.current.material.map = spriteTextures[view];
        outline.current.material.needsUpdate = true;
        spriteView.current = view;
      }
    }
  });
  return (
    <group ref={group} name={`unit-${unit.id}`}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.35, 20]} />
        <meshBasicMaterial color="#020807" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {!dead && (selected || targeted || shootable) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
          <ringGeometry args={shootable && !targeted ? [0.48, 0.54, 32] : [0.42, 0.49, 32]} />
          <meshBasicMaterial color={targeted ? '#ff786d' : shootable ? '#f3bd76' : '#69e7ca'} transparent opacity={0.92} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={bodyGroup}>
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
        <group ref={rifle} position={[0.28, 0.91, 0.16]} rotation={[0.12, 0, -0.12]}>
          <mesh>
            <boxGeometry args={[0.14, 0.14, 0.5]} />
            <meshStandardMaterial color="#202722" roughness={0.55} metalness={0.52} />
          </mesh>
          <mesh position={[0, 0, 0.33]}>
            <boxGeometry args={[0.07, 0.07, 0.22]} />
            <meshStandardMaterial color="#a39a7d" roughness={0.42} metalness={0.62} />
          </mesh>
          <mesh ref={muzzle} position={[0, 0, 0.5]} visible={false}>
            <planeGeometry args={[0.42, 0.42]} />
            <meshBasicMaterial ref={muzzleMaterial} color="#ffd27a" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <group ref={billboard} position={[0, 0.82, 0]}>
        <mesh ref={outline} scale={[1.16, 1.14, 1]} position={[0, 0, -0.015]}>
          <planeGeometry args={[0.92, 1.38]} />
          <meshBasicMaterial map={spriteTextures.front} color={unit.team === 'alien' ? '#29151c' : '#10231e'} transparent alphaTest={0.2} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh ref={sprite}>
          <planeGeometry args={[1.06, 1.52]} />
          <meshBasicMaterial map={spriteTextures.front} transparent alphaTest={0.22} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh ref={critOverlay} position={[0, 1.02, 0.05]} visible={false} renderOrder={12}>
          <planeGeometry args={[0.9, 0.45]} />
          <meshBasicMaterial ref={critMaterial} map={critTexture} transparent opacity={0} depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
      </group>
      {shootable && hitChance != null && (
        <Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="enemy-hit-chance">{hitChance}%</span>
        </Html>
      )}
    </group>
  );
}

function BeamEffect({ shot, camera }) {
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

function CameraRig({ floorRef, cells, onCellTap, focusUnit, focusToken, mapOffset, movingUnitId, rotateToken }) {
  const { camera, gl, size, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const focusId = focusUnit?.id;

  useEffect(() => {
    if (!focusUnit || movingUnitId) return;
    const target = new THREE.Vector3(
      toWorld(focusUnit).x + mapOffset,
      toWorldY(focusUnit),
      toWorld(focusUnit).z + mapOffset,
    );
    const forward = camera.getWorldDirection(new THREE.Vector3());
    if (Math.abs(forward.y) < 1e-6) return;
    // Intersect the view ray with the unit's height plane to find the current view center.
    const t = (target.y - camera.position.y) / forward.y;
    const center = camera.position.clone().addScaledVector(forward, t);
    camera.position.x += target.x - center.x;
    camera.position.z += target.z - center.z;
  }, [focusId, focusToken, movingUnitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);

  // Quarter-turn requests from the HUD (rotateToken changes) and keyboard use the same rotator.
  useEffect(() => {
    if (!rotateToken) return;
    rotateCamera(camera, rotateToken.direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateToken]);

  useFrame((_, delta) => {
    if (!movingUnitId) return;
    const obj = scene.getObjectByName(`unit-${movingUnitId}`);
    if (obj) {
      obj.getWorldPosition(worldPos);
      camera.getWorldDirection(forward);
      if (Math.abs(forward.y) > 1e-6) {
        const t = (worldPos.y - camera.position.y) / forward.y;
        const center = camera.position.clone().addScaledVector(forward, t);
        const k = Math.min(1, delta * 10);
        camera.position.x += (worldPos.x - center.x) * k;
        camera.position.z += (worldPos.z - center.z) * k;
      }
    }
  });

  useEffect(() => {
    const element = gl.domElement;
    const pointers = new Map();
    let gesture = null;
    let moved = false;

    const distanceAndAngle = () => {
      const [first, second] = [...pointers.values()];
      if (!first || !second) return null;
      return {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        angle: Math.atan2(second.y - first.y, second.x - first.x),
      };
    };
    const pan = (dx, dy) => {
      const scale = (camera.top - camera.bottom) / (camera.zoom * size.height);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const vertical = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      right.y = 0;
      vertical.y = 0;
      right.normalize();
      vertical.normalize();
      camera.position.addScaledVector(right, -dx * scale);
      camera.position.addScaledVector(vertical, dy * scale);
    };
    const pointerDown = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      element.setPointerCapture?.(event.pointerId);
      moved = false;
      if (pointers.size === 1) gesture = { last: { x: event.clientX, y: event.clientY }, origin: { x: event.clientX, y: event.clientY }, isPinch: false };
      if (pointers.size === 2) {
        gesture = { ...distanceAndAngle(), isPinch: true, lastAngle: distanceAndAngle().angle, rotationAcc: 0 };
      }
    };
    const pointerMove = (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2 && gesture?.isPinch) {
        const current = distanceAndAngle();
        if (!current) return;
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * (current.distance / Math.max(1, gesture.distance)), 18, 72);
        gesture.distance = current.distance;
        let angleDelta = current.angle - gesture.lastAngle;
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        gesture.lastAngle = current.angle;
        gesture.rotationAcc += angleDelta;
        const STEP = Math.PI / 2;
        while (Math.abs(gesture.rotationAcc) >= STEP / 2) {
          const dir = Math.sign(gesture.rotationAcc);
          rotateCamera(camera, dir);
          gesture.rotationAcc -= dir * STEP;
        }
        moved = true;
        camera.updateProjectionMatrix();
      } else if (pointers.size === 1 && gesture && !gesture.isPinch) {
        const dx = event.clientX - gesture.last.x;
        const dy = event.clientY - gesture.last.y;
        if (Math.hypot(event.clientX - gesture.origin.x, event.clientY - gesture.origin.y) > 6) moved = true;
        if (moved) pan(dx, dy);
        gesture.last = { x: event.clientX, y: event.clientY };
      }
    };
    const pointerUp = (event) => {
      const point = pointers.get(event.pointerId);
      if (point && !moved && pointers.size === 1 && floorRef.current) {
        const rect = element.getBoundingClientRect();
        pointer.set(((point.x - rect.left) / rect.width) * 2 - 1, -((point.y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(floorRef.current)[0];
        if (hit?.instanceId !== undefined) onCellTap(cells[hit.instanceId]);
      }
      pointers.delete(event.pointerId);
      if (pointers.size === 1) {
        const [remaining] = pointers.values();
        gesture = { last: remaining, origin: remaining, isPinch: false };
        moved = false;
      } else if (pointers.size === 0) {
        gesture = null;
      }
    };
    const wheel = (event) => {
      event.preventDefault();
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 18, 72);
      camera.updateProjectionMatrix();
    };
    const keydown = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'q' || key === 'e') {
        rotateCamera(camera, key === 'q' ? -1 : 1);
      } else if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        const distance = 1.2;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const vertical = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        right.y = 0;
        vertical.y = 0;
        right.normalize();
        vertical.normalize();
        const dx = key === 'a' || key === 'arrowleft' ? 1 : key === 'd' || key === 'arrowright' ? -1 : 0;
        const dy = key === 'w' || key === 'arrowup' ? -1 : key === 's' || key === 'arrowdown' ? 1 : 0;
        camera.position.addScaledVector(right, dx * distance).addScaledVector(vertical, dy * distance);
      }
    };

    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerUp);
    element.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keydown);
    return () => {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerUp);
      element.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keydown);
    };
  }, [camera, cells, floorRef, gl, onCellTap, pointer, raycaster, size.height]);

  return null;
}

// Rotates the orbit camera a quarter turn around the map centre.
function rotateCamera(camera, direction) {
  const offset = camera.position.clone();
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 2);
  camera.position.copy(offset);
  camera.lookAt(0, 0, 0);
}

function Battlefield({ state, selected, coverProfiles, focusUnit, focusToken, target, paths, pendingMove, visibleCellKeys, shootableEnemyIds, enemyHitChances, onCellTap, movingUnitId, rotateToken }) {
  const { camera } = useThree();
  const floorRef = useRef();
  const allCells = useMemo(() => Object.values(state.map.cells), [state.map]);
  const visibleCells = useMemo(() => allCells.filter((cell) => cell.level === 0 || state.showUpper), [allCells, state.showUpper]);
  const revealedCells = useMemo(() => visibleCells.filter((cell) => visibleCellKeys.has(cellKey(cell))), [visibleCellKeys, visibleCells]);
  // Only show reachable tiles on displayed floors that the player can currently see (fog hides the rest).
  const shownPaths = useMemo(() => new Map([...paths].filter(([key, value]) => {
    const cell = state.map.cells[key];
    return cell && (cell.level === 0 || state.showUpper) && visibleCellKeys.has(key) && value;
  })), [paths, state.map, state.showUpper, visibleCellKeys]);
  const groundData = useMemo(() => visibleCells.filter((cell) => cell.walkable), [visibleCells]);
  const pendingPath = pendingMove ? paths.get(cellKey(pendingMove))?.path : null;
  const mapOffset = CELL_OFFSET - (state.map.size - 1) / 2;
  return (
    <>
      <color attach="background" args={['#111817']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[8, 18, 7]} intensity={2.2} color="#d7eadb" />
      <directionalLight position={[-12, 8, -10]} intensity={0.55} color="#73bcb3" />
      <TilemapGround map={state.map} visibleCellKeys={visibleCellKeys} />
      <group position={[mapOffset, 0, mapOffset]}>
      <InstancedGround cells={allCells} visibleCells={visibleCells} meshRef={floorRef} />
      <WallField cells={revealedCells} selected={selected} />
      <CoverField cells={revealedCells} selected={selected} />
      <FogOfWar cells={visibleCells} visibleCellKeys={visibleCellKeys} />
      {selected?.ap > 0 && <ReachableOverlay paths={shownPaths} map={state.map} coverProfiles={coverProfiles} />}
      {pendingPath && selected && <MoveTrace path={pendingPath} start={selected} />}
      {pendingMove && <SideCoverMarkers state={state} unit={pendingMove} />}
      {state.units.filter((unit) => unit.team === 'player' && unit.hp > 0).map((unit) => <SideCoverMarkers key={`cover-${unit.id}`} state={state} unit={unit} />)}
      <FlankLines state={state} visibleCellKeys={visibleCellKeys} />
      {selected && target && <AimBeam shooter={selected} target={target} blocked={!hasLineOfSight(state.map, selected, target)} />}
      {state.units.filter((unit) => unit.team === 'player' || visibleCellKeys.has(cellKey(unit))).map((unit) => (
        <PixelUnit key={`${state.generation}:${unit.id}`} unit={unit} selected={unit.id === state.selectedId} targeted={unit.id === state.targetId} shootable={shootableEnemyIds.has(unit.id)} hitChance={enemyHitChances?.get(unit.id)} camera={camera} movement={state.movement} visibleCellKeys={visibleCellKeys} lastShot={state.lastShot} />
      ))}
      {state.lastShot && <BeamEffect key={state.lastShot.id} shot={state.lastShot} camera={camera} />}
      </group>
      <CameraRig floorRef={floorRef} cells={groundData} onCellTap={onCellTap} focusUnit={focusUnit} focusToken={focusToken} mapOffset={mapOffset} movingUnitId={movingUnitId} rotateToken={rotateToken} />
    </>
  );
}

export default function GameScene({ state, selected, coverProfiles, focusUnit, focusToken, target, paths, pendingMove, visibleCellKeys, shootableEnemyIds, enemyHitChances, onCellTap, movingUnitId, rotateToken }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [23, 28, 23], zoom: Math.max(30, 50 * 32 / state.map.size), near: 0.1, far: 200 }}
      dpr={Math.min(window.devicePixelRatio || 1, 2)}
      gl={{ antialias: false, powerPreference: 'low-power', alpha: false }}
      style={{ touchAction: 'none' }}
    >
      <Battlefield state={state} selected={selected} coverProfiles={coverProfiles} focusUnit={focusUnit} focusToken={focusToken} target={target} paths={paths} pendingMove={pendingMove} visibleCellKeys={visibleCellKeys} shootableEnemyIds={shootableEnemyIds} enemyHitChances={enemyHitChances} onCellTap={onCellTap} movingUnitId={movingUnitId} rotateToken={rotateToken} />
    </Canvas>
  );
}