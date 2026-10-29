import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import GameScene from './components/GameScene.jsx';
import { TacticalHud } from './components/TacticalHud.jsx';
import {
  cellKey,
  computeHitChance,
  createInitialState,
  gameReducer,
  getReachable,
  movementLimits,
  SHOT_RANGE,
} from './engine/game.js';
import { getCoverProfile, getVisibleCells, hasLineOfSight } from './engine/map.js';
import { getNextReadyUnit } from './rules/index.ts';
import { loadGame, MAX_ROUNDS_BACK, saveGame } from './persistence/save.js';
import { createDirector } from './presentation/director.js';
import { parseFastFactor, scaledScheduler } from './presentation/fastScheduler.js';

export default function App() {
  // Loaded once on mount: the live state plus round-start checkpoints (oldest first, last = current round start).
  const [initialSave] = useState(() => {
    const loaded = loadGame();
    if (loaded) return loaded;
    const fresh = createInitialState();
    return { current: fresh, checkpoints: [fresh] };
  });
  const [state, dispatch] = useReducer(gameReducer, initialSave.current);
  // Round history for undo. `start` is the current round's start; `previous` holds up to
  // MAX_ROUNDS_BACK earlier round starts, oldest first. Kept in a ref so it survives re-renders
  // without triggering them. Synced during render, which is idempotent.
  const roundsRef = useRef(null);
  if (!roundsRef.current) {
    roundsRef.current = {
      start: initialSave.checkpoints[initialSave.checkpoints.length - 1],
      previous: initialSave.checkpoints.slice(0, -1),
    };
  }
  const rounds = roundsRef.current;
  if (state.generation !== rounds.start.generation || state.turn < rounds.start.turn) {
    // New map or a reset: history of the old game no longer applies.
    rounds.start = state;
    rounds.previous = [];
  } else if (state.turn > rounds.start.turn) {
    rounds.previous = [...rounds.previous, rounds.start].slice(-MAX_ROUNDS_BACK);
    rounds.start = state;
  }
  const roundsBack = rounds.previous.length;
  const undoRound = () => {
    const { previous } = roundsRef.current;
    if (previous.length === 0 || state.phase !== 'player' || state.movement) return;
    const target = previous[previous.length - 1];
    roundsRef.current = { start: target, previous: previous.slice(0, -1) };
    setPendingMove(null);
    dispatch({ type: 'restore-state', state: target });
  };
  // Auto-save only settled player-phase states: enemy turns and animations are not restorable.
  useEffect(() => {
    if (state.phase !== 'player' || state.movement || state.lastShot) return;
    saveGame({ current: state, checkpoints: [...roundsRef.current.previous, roundsRef.current.start] });
  }, [state]);
  const [pendingMove, setPendingMove] = useState(null);
  const [showNewGameWarning, setShowNewGameWarning] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  // Each camera quarter-turn request bumps the token; GameScene rotates once per change.
  const [rotateToken, setRotateToken] = useState(null);
  const rotateCamera = useCallback(
    (direction) => setRotateToken((previous) => ({ direction, n: (previous?.n ?? 0) + 1 })),
    []
  );
  const selected = state.units.find((unit) => unit.id === state.selectedId && unit.hp > 0);
  const target = state.units.find((unit) => unit.id === state.targetId && unit.hp > 0);
  // While a player unit moves, fog of war follows its current path cell instead of its final position.
  const observerUnits = useMemo(() => {
    const movingPlayer =
      state.movement && state.units.find((unit) => unit.id === state.movement.unitId && unit.team === 'player');
    const currentCell = movingPlayer && state.movement.path[state.movement.step];
    if (!currentCell) return state.units;
    return state.units.map((unit) =>
      unit.id === movingPlayer.id ? { ...unit, x: currentCell.x, z: currentCell.z, level: currentCell.level } : unit
    );
  }, [state.movement, state.units]);
  const visibleCellKeys = useMemo(() => getVisibleCells(state.map, observerUnits), [state.map, observerUnits]);
  const shootableEnemyIds = useMemo(() => {
    if (!selected || selected.ap < 1) return new Set();
    return new Set(
      state.units
        .filter((unit) => unit.team === 'alien' && unit.hp > 0)
        .filter(
          (unit) =>
            visibleCellKeys.has(cellKey(unit)) &&
            hasLineOfSight(state.map, selected, unit) &&
            Math.hypot(selected.x - unit.x, selected.z - unit.z) <= SHOT_RANGE
        )
        .map((unit) => unit.id)
    );
  }, [selected, state.map, state.units, visibleCellKeys]);
  const enemyHitChances = useMemo(() => {
    const chances = new Map();
    if (!selected || selected.ap < 1) return chances;
    state.units
      .filter((unit) => shootableEnemyIds.has(unit.id))
      .forEach((unit) => chances.set(unit.id, Math.round(computeHitChance(state, selected, unit) * 100)));
    return chances;
  }, [selected, shootableEnemyIds, state]);
  const activeEnemy =
    state.phase === 'enemy'
      ? state.units.find((unit) => unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0)
      : null;
  const focusUnit =
    state.phase === 'enemy'
      ? activeEnemy && visibleCellKeys.has(cellKey(activeEnemy))
        ? activeEnemy
        : null
      : selected;
  const focusToken = state.phase === 'enemy' ? state.enemyTurnIndex : 0;
  // Hidden enemy actions have no visual output, so their timers can run without delay.
  const activeEnemyHidden = state.phase === 'enemy' && (!activeEnemy || !visibleCellKeys.has(cellKey(activeEnemy)));
  const movementHidden = !!state.movement && state.movement.path.every((cell) => !visibleCellKeys.has(cellKey(cell)));
  // Same definition the reducer uses when it hands over selection (rules/turns/readyUnit.js).
  const nextReadyUnit = useMemo(() => getNextReadyUnit(state), [state]);
  // Latest turn state for callbacks that must not be re-created on every render (D8).
  const turnRef = useRef({});
  turnRef.current = { phase: state.phase, movement: state.movement, lastShot: state.lastShot, nextReadyUnit };
  const requestEndTurn = useCallback(() => {
    const { phase, movement, lastShot, nextReadyUnit: next } = turnRef.current;
    if (phase !== 'player' || movement || lastShot) return;
    if (next) {
      setPendingMove(null);
      dispatch({ type: 'select', id: next.id });
      return;
    }
    dispatch({ type: 'end-turn' });
  }, []);
  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(state.map.seed));
      setSeedCopied(true);
      window.setTimeout(() => setSeedCopied(false), 1500);
    } catch {
      setSeedCopied(false);
    }
  };

  const paths = useMemo(() => {
    if (
      state.phase !== 'player' ||
      state.movement ||
      !selected ||
      selected.team !== 'player' ||
      !state.moveMode ||
      selected.ap < 1
    )
      return new Map();
    const blocked = new Set(state.units.filter((unit) => unit.id !== selected.id && unit.hp > 0).map(cellKey));
    const { maxSteps, stepsPerAp } = movementLimits(selected);
    return getReachable(state.map, selected, blocked, maxSteps, stepsPerAp);
  }, [selected, state.map, state.moveMode, state.movement, state.phase, state.units]);
  // Protection of every cell the selected unit could move to, shown as ground tint.
  const coverProfiles = useMemo(() => {
    const profiles = new Map();
    if (!selected || selected.ap < 1) return profiles;
    paths.forEach((_, key) => profiles.set(key, getCoverProfile(state.map, state.map.cells[key])));
    return profiles;
  }, [paths, selected, state.map]);
  const pendingPath = pendingMove ? paths.get(cellKey(pendingMove)) : null;
  const pendingCover = pendingMove ? getCoverProfile(state.map, pendingMove) : null;

  useEffect(() => {
    if (pendingMove && !pendingPath) setPendingMove(null);
  }, [pendingMove, pendingPath]);

  // Timers for shots, enemy steps and movement live in the director (presentation/director.js).
  // sync() runs after every render and re-arms only the steps whose inputs changed.
  const directorRef = useRef(null);
  if (!directorRef.current) {
    // ?fast=4 (or ?fast) speeds up all presentation delays for testing; default is normal speed.
    const fastFactor = parseFastFactor(new URLSearchParams(window.location.search).get('fast'));
    directorRef.current = createDirector({
      dispatch,
      scheduler: scaledScheduler(globalThis, fastFactor),
    });
  }
  useEffect(() => {
    directorRef.current.sync(state, { activeEnemyHidden, movementHidden });
  });
  useEffect(() => () => directorRef.current.dispose(), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPendingMove(null);
        setShowNewGameWarning(false);
        return;
      }
      if (showNewGameWarning) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'm') dispatch({ type: 'toggle-move-mode' });
      if (key === 'o') dispatch({ type: 'ability', name: 'overwatch' });
      if (event.key === 'Enter') requestEndTurn();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestEndTurn, showNewGameWarning]);

  const tapCell = (cell) => {
    if (state.phase !== 'player' || state.movement) return;
    const occupant = state.units.find(
      (unit) =>
        unit.x === cell.x &&
        unit.z === cell.z &&
        unit.level === cell.level &&
        unit.hp > 0 &&
        (unit.team === 'player' || visibleCellKeys.has(cellKey(unit)))
    );
    if (occupant?.team === 'player') {
      setPendingMove(null);
      dispatch({ type: 'select', id: occupant.id });
      return;
    }
    if (occupant?.team === 'alien') {
      setPendingMove(null);
      dispatch({ type: 'target', id: occupant.id });
      return;
    }
    if (!state.moveMode) {
      setPendingMove(null);
      dispatch({ type: 'move-mode' });
      return;
    }
    if (paths.has(cellKey(cell))) {
      setPendingMove(cell);
      return;
    }
    setPendingMove(null);
  };

  const confirmMove = () => {
    if (state.phase !== 'player' || !pendingMove || !pendingPath || !selected || pendingPath.apCost > selected.ap)
      return;
    dispatch({ type: 'move', destination: pendingMove });
    setPendingMove(null);
  };

  const regenerate = () => {
    setShowNewGameWarning(false);
    dispatch({ type: 'regenerate', seed: Math.floor(Math.random() * 900000) + 100000 });
  };
  const requestRegenerate = () => setShowNewGameWarning(true);

  return (
    <main className="game-shell">
      <div className="scene-wrap">
        <GameScene
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
          onCellTap={tapCell}
          movingUnitId={state.movement?.unitId ?? null}
          rotateToken={rotateToken}
        />
      </div>
      <TacticalHud
        state={state}
        selected={selected}
        target={target}
        seedCopied={seedCopied}
        onCopySeed={copySeed}
        hasShootableEnemy={shootableEnemyIds.size > 0}
        pendingMove={pendingMove}
        pendingMoveCost={pendingPath?.apCost}
        pendingCover={pendingCover}
        nextReadyUnit={nextReadyUnit}
        onConfirmMove={confirmMove}
        onRequestEndTurn={requestEndTurn}
        showNewGameWarning={showNewGameWarning}
        onRequestRegenerate={requestRegenerate}
        roundsBack={roundsBack}
        onUndoRound={undoRound}
        onConfirmRegenerate={regenerate}
        onCancelRegenerate={() => setShowNewGameWarning(false)}
        onAction={dispatch}
        onRotateCamera={rotateCamera}
        onToggleLevels={() => dispatch({ type: 'toggle-levels' })}
        onSelect={(id) => dispatch({ type: 'select', id })}
      />
      <div className="scanline-overlay" aria-hidden="true" />
    </main>
  );
}
