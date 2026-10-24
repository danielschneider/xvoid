import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { cellKey } from '../engine/map.js';

const LEVEL_HEIGHT = 1.5;

function createSpriteTexture(team, color, className) {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  const pixel = (x, y, width, height, fill) => {
    context.fillStyle = fill;
    context.fillRect(x, y, width, height);
  };
  const glow = team === 'alien' ? '#ff7770' : color;
  const armor = team === 'alien' ? '#39242d' : '#203737';
  pixel(18, 3, 12, 3, glow);
  pixel(15, 6, 18, 13, '#a8c3b8');
  pixel(13, 10, 3, 6, armor);
  pixel(32, 10, 3, 6, armor);
  pixel(16, 18, 16, 2, glow);
  pixel(11, 21, 26, 20, armor);
  pixel(8, 23, 5, 16, glow);
  pixel(35, 23, 5, 16, glow);
  pixel(14, 24, 20, 7, '#547b70');
  pixel(20, 31, 8, 8, glow);
  pixel(14, 41, 8, 15, '#20302f');
  pixel(26, 41, 8, 15, '#20302f');
  pixel(10, 55, 12, 4, glow);
  pixel(26, 55, 12, 4, glow);
  pixel(19, 10, 3, 3, team === 'alien' ? '#ffb19a' : '#eaffcf');
  pixel(24, 10, 3, 3, team === 'alien' ? '#ffb19a' : '#eaffcf');
  if (className === 'RECON') pixel(36, 20, 4, 28, '#98baff');
  if (className === 'FIELD MEDIC') pixel(20, 23, 8, 3, '#f5efc7');
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function InstancedGround({ cells, visibleCells, meshRef }) {
  const data = useMemo(() => visibleCells.filter((cell) => cell.walkable), [visibleCells]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0.12 }), []);

  useEffect(() => {
    if (!meshRef.current) return;
    data.forEach((cell, index) => {
      dummy.position.set(cell.x - 15.5, cell.level * LEVEL_HEIGHT - 0.08, cell.z - 15.5);
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
  }, [data, dummy, meshRef]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, material, data.length]} receiveShadow={false}>
      <boxGeometry args={[0.98, 0.16, 0.98]} />
    </instancedMesh>
  );
}

function CoverField({ cells, selected }) {
  const data = useMemo(() => cells.filter((cell) => cell.terrain === 'console' || cell.terrain === 'pillar'), [cells]);
  return data.map((cell) => {
    const height = cell.terrain === 'pillar' ? 1.14 : 0.46;
    const position = [cell.x - 15.5, cell.level * LEVEL_HEIGHT + height / 2, cell.z - 15.5];
    return (
      <group key={cellKey(cell)} position={position}>
        <mesh castShadow={false}>
          <boxGeometry args={cell.terrain === 'pillar' ? [0.64, height, 0.64] : [0.82, height, 0.56]} />
          <meshStandardMaterial color={cell.terrain === 'pillar' ? '#708078' : '#57716b'} roughness={0.7} metalness={0.36} />
        </mesh>
        <mesh position={[0, height / 2 + 0.012, 0]}>
          <boxGeometry args={[0.68, 0.025, 0.6]} />
          <meshBasicMaterial color={selected ? '#54dfc1' : '#9cd2bd'} />
        </mesh>
      </group>
    );
  });
}

function WallField({ cells, selected }) {
  return cells.filter((cell) => cell.terrain === 'wall').map((cell) => {
    const nearby = selected && Math.hypot(selected.x - cell.x, selected.z - cell.z) < 5;
    return (
      <mesh key={cellKey(cell)} position={[cell.x - 15.5, 0.74, cell.z - 15.5]}>
        <boxGeometry args={[1, 1.55, 1]} />
        <meshStandardMaterial color="#68746d" roughness={0.8} metalness={0.25} transparent={nearby} opacity={nearby ? 0.34 : 1} />
      </mesh>
    );
  });
}

function ReachableOverlay({ paths, map }) {
  const entries = useMemo(() => [...paths.entries()].map(([key, value]) => ({ cell: map.cells[key], ...value })), [map, paths]);
  return entries.map(({ cell, apCost, steps }) => (
    <mesh key={cellKey(cell)} position={[cell.x - 15.5, cell.level * LEVEL_HEIGHT + 0.018, cell.z - 15.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.8, 0.8]} />
      <meshBasicMaterial color={apCost === 1 ? '#52b9ee' : '#efc451'} transparent opacity={steps <= 5 ? 0.23 : 0.28} depthWrite={false} />
    </mesh>
  ));
}

function MoveTrace({ path, start }) {
  const points = useMemo(() => [start, ...path].map((cell) => (
    new THREE.Vector3(cell.x - 15.5, cell.level * LEVEL_HEIGHT + 0.055, cell.z - 15.5)
  )), [path, start]);
  return <Line points={points} color="#d7f279" lineWidth={4} transparent opacity={0.95} />;
}

function PixelUnit({ unit, selected, targeted, camera }) {
  const sprite = useRef();
  const texture = useMemo(() => createSpriteTexture(unit.team, unit.color, unit.className), [unit.team, unit.color, unit.className]);
  const ground = [unit.x - 15.5, unit.level * LEVEL_HEIGHT + 0.035, unit.z - 15.5];
  useFrame(() => {
    if (sprite.current) sprite.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group position={ground}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.35, 20]} />
        <meshBasicMaterial color="#020807" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {(selected || targeted) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
          <ringGeometry args={[0.42, 0.49, 32]} />
          <meshBasicMaterial color={targeted ? '#ff786d' : '#69e7ca'} transparent opacity={0.92} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh ref={sprite} position={[0, 0.82, 0]}>
        <planeGeometry args={[0.9, 1.32]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.25} depthWrite side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {unit.hp <= 0 && <mesh position={[0, 0.18, 0]} rotation={[0, 0, -0.4]}><boxGeometry args={[0.7, 0.09, 0.12]} /><meshBasicMaterial color="#9c4d4b" /></mesh>}
    </group>
  );
}

function BeamEffect({ shot, camera }) {
  const line = useRef();
  const damageMaterial = useRef();
  const elapsed = useRef(0);
  const previousShake = useRef({ x: 0, y: 0 });
  const damageTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.font = 'bold 42px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 6;
    context.strokeStyle = '#17201c';
    context.fillStyle = shot.hit ? '#ff9580' : '#9ce3e3';
    const label = shot.hit ? `-${shot.damage}` : 'MISS';
    context.strokeText(label, 64, 34);
    context.fillText(label, 64, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [shot.damage, shot.hit]);
  const from = shot.from;
  const to = shot.to;
  const points = [
    new THREE.Vector3(from.x - 15.5, from.level * LEVEL_HEIGHT + 0.8, from.z - 15.5),
    new THREE.Vector3(to.x - 15.5, to.level * LEVEL_HEIGHT + 0.8, to.z - 15.5),
  ];
  useFrame((_, delta) => {
    elapsed.current += delta;
    const opacity = Math.max(0, 1 - elapsed.current / 0.65);
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
      <mesh position={[points[1].x, points[1].y + 0.72, points[1].z]} quaternion={camera.quaternion}>
        <planeGeometry args={[0.8, 0.4]} />
        <meshBasicMaterial ref={damageMaterial} map={damageTexture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

function CameraRig({ floorRef, cells, onCellTap }) {
  const { camera, gl, size } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    const element = gl.domElement;
    const pointers = new Map();
    let gesture = null;
    let moved = false;

    const rotateCamera = (direction) => {
      const offset = camera.position.clone();
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 2);
      camera.position.copy(offset);
      camera.lookAt(0, 0, 0);
    };
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
        gesture = { ...distanceAndAngle(), isPinch: true, lastAngle: distanceAndAngle().angle };
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
        if (Math.abs(angleDelta) > Math.PI / 4) {
          rotateCamera(Math.sign(angleDelta));
          gesture.lastAngle = current.angle;
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
        rotateCamera(key === 'q' ? -1 : 1);
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

function Battlefield({ state, selected, paths, pendingMove, onCellTap }) {
  const { camera } = useThree();
  const floorRef = useRef();
  const allCells = useMemo(() => Object.values(state.map.cells), [state.map]);
  const visibleCells = useMemo(() => allCells.filter((cell) => cell.level === 0 || state.showUpper), [allCells, state.showUpper]);
  const groundData = useMemo(() => visibleCells.filter((cell) => cell.walkable), [visibleCells]);
  const pendingPath = pendingMove ? paths.get(cellKey(pendingMove))?.path : null;
  return (
    <>
      <color attach="background" args={['#111817']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[8, 18, 7]} intensity={2.2} color="#d7eadb" />
      <directionalLight position={[-12, 8, -10]} intensity={0.55} color="#73bcb3" />
      <InstancedGround cells={allCells} visibleCells={visibleCells} meshRef={floorRef} />
      {[0, 1, 2].map((level) => (level === 0 || state.showUpper) && (
        <gridHelper key={level} args={[32, 32, '#43504a', '#313d39']} position={[0, level * LEVEL_HEIGHT + 0.008, 0]} />
      ))}
      <WallField cells={visibleCells} selected={selected} />
      <CoverField cells={visibleCells} selected={selected} />
      {selected?.ap > 0 && <ReachableOverlay paths={paths} map={state.map} />}
      {pendingPath && selected && <MoveTrace path={pendingPath} start={selected} />}
      {state.units.map((unit) => unit.hp > 0 && (
        <PixelUnit key={unit.id} unit={unit} selected={unit.id === state.selectedId} targeted={unit.id === state.targetId} camera={camera} />
      ))}
      {state.lastShot && <BeamEffect key={state.lastShot.id} shot={state.lastShot} camera={camera} />}
      <CameraRig floorRef={floorRef} cells={groundData} onCellTap={onCellTap} />
    </>
  );
}

export default function GameScene({ state, selected, paths, pendingMove, onCellTap }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [23, 28, 23], zoom: 34, near: 0.1, far: 150 }}
      dpr={Math.min(window.devicePixelRatio || 1, 2)}
      gl={{ antialias: false, powerPreference: 'low-power', alpha: false }}
      style={{ touchAction: 'none' }}
    >
      <Battlefield state={state} selected={selected} paths={paths} pendingMove={pendingMove} onCellTap={onCellTap} />
    </Canvas>
  );
}