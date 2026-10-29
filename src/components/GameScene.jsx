import { useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { cellKey } from '../engine/map.ts';
import { getCoverAgainst } from '../rules/index.ts';
import { CELL_OFFSET } from './scene/coords.js';
import { TilemapGround } from './scene/terrain/TilemapGround.jsx';
import { InstancedGround } from './scene/terrain/InstancedGround.jsx';
import { WallField } from './scene/terrain/WallField.jsx';
import { CoverField } from './scene/terrain/CoverField.jsx';
import { StructureField } from './scene/terrain/StructureField.jsx';
import { FogOfWar } from './scene/terrain/FogOfWar.jsx';
import { ReachableOverlay } from './scene/overlays/ReachableOverlay.jsx';
import { MoveTrace } from './scene/overlays/MoveTrace.jsx';
import { SideCoverMarkers } from './scene/overlays/SideCoverMarkers.jsx';
import { FlankLines } from './scene/overlays/FlankLines.jsx';
import { BeamEffect } from './scene/effects/BeamEffect.jsx';
import { CameraRig } from './scene/camera/CameraRig.jsx';
import { PixelUnit } from './scene/units/PixelUnit.jsx';

function Battlefield({
  state,
  selected,
  coverProfiles,
  focusUnit,
  focusToken,
  target,
  paths,
  pendingMove,
  visibleCellKeys,
  shootableEnemyIds,
  enemyHitChances,
  onCellTap,
  movingUnitId,
  rotateToken,
}) {
  const { camera } = useThree();
  const floorRef = useRef();
  const allCells = useMemo(() => Object.values(state.map.cells), [state.map]);
  const visibleCells = useMemo(
    () => allCells.filter((cell) => cell.level === 0 || state.showUpper),
    [allCells, state.showUpper]
  );
  const revealedCells = useMemo(
    () => visibleCells.filter((cell) => visibleCellKeys.has(cellKey(cell))),
    [visibleCellKeys, visibleCells]
  );
  // Only show reachable tiles on displayed floors that the player can currently see (fog hides the rest).
  const shownPaths = useMemo(
    () =>
      new Map(
        [...paths].filter(([key, value]) => {
          const cell = state.map.cells[key];
          return cell && (cell.level === 0 || state.showUpper) && visibleCellKeys.has(key) && value;
        })
      ),
    [paths, state.map, state.showUpper, visibleCellKeys]
  );
  const groundData = useMemo(() => visibleCells.filter((cell) => cell.walkable), [visibleCells]);
  // Cover the target has against the last shot, as { cover, flanked } for the impact effect.
  const lastShotCover = useMemo(() => {
    const shot = state.lastShot;
    if (!shot) return null;
    const shooter = state.units.find((unit) => unit.id === shot.from.id);
    const target = state.units.find((unit) => unit.id === shot.to.id);
    if (!shooter || !target) return null;
    return getCoverAgainst(state.map, target, shooter);
  }, [state.lastShot, state.units, state.map]);
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
        <StructureField cells={revealedCells} />
        <FogOfWar cells={visibleCells} visibleCellKeys={visibleCellKeys} />
        {selected?.ap > 0 && <ReachableOverlay paths={shownPaths} map={state.map} coverProfiles={coverProfiles} />}
        {pendingPath && selected && <MoveTrace path={pendingPath} start={selected} />}
        {pendingMove && <SideCoverMarkers state={state} unit={pendingMove} />}
        {state.units
          .filter((unit) => unit.team === 'player' && unit.hp > 0)
          .map((unit) => (
            <SideCoverMarkers key={`cover-${unit.id}`} state={state} unit={unit} />
          ))}
        <FlankLines state={state} visibleCellKeys={visibleCellKeys} />
        {state.units
          .filter((unit) => unit.team === 'player' || visibleCellKeys.has(cellKey(unit)))
          .map((unit) => (
            <PixelUnit
              key={`${state.generation}:${unit.id}`}
              unit={unit}
              selected={unit.id === state.selectedId}
              targeted={unit.id === state.targetId}
              shootable={shootableEnemyIds.has(unit.id)}
              hitChance={enemyHitChances?.get(unit.id)}
              camera={camera}
              movement={state.movement}
              visibleCellKeys={visibleCellKeys}
              lastShot={state.lastShot}
            />
          ))}
        {state.lastShot && (
          <BeamEffect key={state.lastShot.id} shot={state.lastShot} camera={camera} cover={lastShotCover} />
        )}
      </group>
      <CameraRig
        floorRef={floorRef}
        cells={groundData}
        onCellTap={onCellTap}
        focusUnit={focusUnit}
        focusToken={focusToken}
        mapOffset={mapOffset}
        movingUnitId={movingUnitId}
        rotateToken={rotateToken}
      />
    </>
  );
}

export default function GameScene({
  state,
  selected,
  coverProfiles,
  focusUnit,
  focusToken,
  target,
  paths,
  pendingMove,
  visibleCellKeys,
  shootableEnemyIds,
  enemyHitChances,
  onCellTap,
  movingUnitId,
  rotateToken,
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [23, 28, 23], zoom: Math.max(30, (50 * 32) / state.map.size), near: 0.1, far: 200 }}
      dpr={Math.min(window.devicePixelRatio || 1, 2)}
      gl={{ antialias: false, powerPreference: 'low-power', alpha: false }}
      style={{ touchAction: 'none' }}
    >
      <Battlefield
        state={state}
        selected={selected}
        coverProfiles={coverProfiles}
        focusUnit={focusUnit}
        focusToken={focusToken}
        target={target}
        paths={paths}
        pendingMove={pendingMove}
        visibleCellKeys={visibleCellKeys}
        shootableEnemyIds={shootableEnemyIds}
        enemyHitChances={enemyHitChances}
        onCellTap={onCellTap}
        movingUnitId={movingUnitId}
        rotateToken={rotateToken}
      />
    </Canvas>
  );
}
