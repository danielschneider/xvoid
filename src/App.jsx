import { useEffect, useMemo, useReducer, useState } from 'react';
import GameScene from './components/GameScene.jsx';
import { TacticalHud } from './components/TacticalHud.jsx';
import { cellKey, computeHitChance, createInitialState, gameReducer, getReachable, SHOT_RANGE } from './engine/game.js';
import { getCoverProfile, getVisibleCells, hasLineOfSight } from './engine/map.js';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState());
  const [pendingMove, setPendingMove] = useState(null);
  const [showNewGameWarning, setShowNewGameWarning] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const selected = state.units.find((unit) => unit.id === state.selectedId && unit.hp > 0);
  const target = state.units.find((unit) => unit.id === state.targetId && unit.hp > 0);
  // While a player unit moves, fog of war follows its current path cell instead of its final position.
  const observerUnits = useMemo(() => {
    const movingPlayer = state.movement && state.units.find((unit) => unit.id === state.movement.unitId && unit.team === 'player');
    const currentCell = movingPlayer && state.movement.path[state.movement.step];
    if (!currentCell) return state.units;
    return state.units.map((unit) => (unit.id === movingPlayer.id
      ? { ...unit, x: currentCell.x, z: currentCell.z, level: currentCell.level }
      : unit));
  }, [state.movement, state.units]);
  const visibleCellKeys = useMemo(() => getVisibleCells(state.map, observerUnits), [state.map, observerUnits]);
  const shootableEnemyIds = useMemo(() => {
    if (!selected || selected.ap < 1) return new Set();
    return new Set(state.units
      .filter((unit) => unit.team === 'alien' && unit.hp > 0)
      .filter((unit) => visibleCellKeys.has(cellKey(unit)) && hasLineOfSight(state.map, selected, unit) && Math.hypot(selected.x - unit.x, selected.z - unit.z) <= SHOT_RANGE)
      .map((unit) => unit.id));
  }, [selected, state.map, state.units, visibleCellKeys]);
  const enemyHitChances = useMemo(() => {
    const chances = new Map();
    if (!selected || selected.ap < 1) return chances;
    state.units
      .filter((unit) => shootableEnemyIds.has(unit.id))
      .forEach((unit) => chances.set(unit.id, Math.round(computeHitChance(state, selected, unit) * 100)));
    return chances;
  }, [selected, shootableEnemyIds, state]);
  const activeEnemy = state.phase === 'enemy'
    ? state.units.find((unit) => unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0)
    : null;
  const focusUnit = state.phase === 'enemy'
    ? (activeEnemy && visibleCellKeys.has(cellKey(activeEnemy)) ? activeEnemy : null)
    : selected;
  const focusToken = state.phase === 'enemy' ? state.enemyTurnIndex : 0;
  // Hidden enemy actions have no visual output, so their timers can run without delay.
  const activeEnemyHidden = state.phase === 'enemy'
    && (!activeEnemy || !visibleCellKeys.has(cellKey(activeEnemy)));
  const movementHidden = !!state.movement
    && state.movement.path.every((cell) => !visibleCellKeys.has(cellKey(cell)));
  const playerUnits = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  // Other living player units that still have AP, in roster order after the currently selected unit.
  const readyUnits = useMemo(() => {
    const ready = playerUnits.filter((unit) => unit.ap > 0 && unit.id !== state.selectedId);
    const selectedIndex = playerUnits.findIndex((unit) => unit.id === state.selectedId);
    return [...ready].sort((a, b) => {
      const ia = (playerUnits.indexOf(a) - selectedIndex + playerUnits.length) % playerUnits.length;
      const ib = (playerUnits.indexOf(b) - selectedIndex + playerUnits.length) % playerUnits.length;
      return ia - ib;
    });
  }, [playerUnits, state.selectedId]);
  const nextReadyUnit = readyUnits[0] ?? null;
  const requestEndTurn = () => {
    if (state.phase !== 'player' || state.movement || state.lastShot) return;
    if (nextReadyUnit) {
      setPendingMove(null);
      dispatch({ type: 'select', id: nextReadyUnit.id });
      return;
    }
    dispatch({ type: 'end-turn' });
  };
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
    if (state.phase !== 'player' || state.movement || !selected || selected.team !== 'player' || !state.moveMode || selected.ap < 1) return new Map();
    const blocked = new Set(state.units.filter((unit) => unit.id !== selected.id && unit.hp > 0).map(cellKey));
    return getReachable(state.map, selected, blocked, selected.ap === 1 ? 5 : 10);
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

  useEffect(() => {
    if (!state.lastShot) return undefined;
    // Player shots keep the shooter selected for a moment so the shot or death is visible before the next unit takes over.
    const timer = window.setTimeout(
      () => dispatch({ type: 'finish-shot', id: state.lastShot.id }),
      state.lastShot.enemyShot ? 1300 : 1000,
    );
    return () => window.clearTimeout(timer);
  }, [state.lastShot]);

  useEffect(() => {
    if (state.phase !== 'enemy' || state.movement) return undefined;
    const finished = state.enemyTurnIndex >= state.enemyTurnOrder.length;
    const delay = !finished && activeEnemyHidden ? 0 : 1400;
    const timer = window.setTimeout(() => {
      dispatch({ type: finished ? 'finish-enemy-turn' : 'enemy-step' });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.enemyTurnIndex, state.enemyTurnOrder.length, state.phase, state.movement, activeEnemyHidden]);

  useEffect(() => {
    if (!state.movement || movementHidden) return undefined;
    const movementId = state.movement.id;
    const timer = window.setInterval(
      () => dispatch({ type: 'advance-movement', id: movementId }),
      220,
    );
    return () => window.clearInterval(timer);
  }, [state.movement?.id, movementHidden]);

  useEffect(() => {
    if (!state.movement) return undefined;
    const timer = window.setTimeout(
      () => dispatch({ type: 'complete-movement', id: state.movement.id }),
      movementHidden ? 0 : state.movement.path.length * 220 + 80,
    );
    return () => window.clearTimeout(timer);
  }, [state.movement, movementHidden]);

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
  }, [requestEndTurn, showNewGameWarning, state.selectedId, target]);

  const tapCell = (cell) => {
    if (state.phase !== 'player' || state.movement) return;
    const occupant = state.units.find((unit) => (
      unit.x === cell.x && unit.z === cell.z && unit.level === cell.level && unit.hp > 0
      && (unit.team === 'player' || visibleCellKeys.has(cellKey(unit)))
    ));
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
    if (state.moveMode && paths.has(cellKey(cell))) {
      setPendingMove(cell);
      return;
    }
    setPendingMove(null);
  };

  const confirmMove = () => {
    if (state.phase !== 'player' || !pendingMove || !pendingPath || !selected || pendingPath.apCost > selected.ap) return;
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
      <div className="scene-wrap"><GameScene state={state} selected={selected} coverProfiles={coverProfiles} focusUnit={focusUnit} focusToken={focusToken} target={target} paths={paths} pendingMove={pendingMove} visibleCellKeys={visibleCellKeys} shootableEnemyIds={shootableEnemyIds} enemyHitChances={enemyHitChances} onCellTap={tapCell} movingUnitId={state.movement?.unitId ?? null} /></div>
      <TacticalHud
        state={state}
        selected={selected}
        target={target}
        seedCopied={seedCopied}
        onCopySeed={copySeed}
        hasShootableEnemy={shootableEnemyIds.size > 0}
        moveMode={state.moveMode}
        pendingMove={pendingMove}
        pendingMoveCost={pendingPath?.apCost}
        pendingCover={pendingCover}
        nextReadyUnit={nextReadyUnit}
        onConfirmMove={confirmMove}
        onRequestEndTurn={requestEndTurn}
        showNewGameWarning={showNewGameWarning}
        onRequestRegenerate={requestRegenerate}
        onConfirmRegenerate={regenerate}
        onCancelRegenerate={() => setShowNewGameWarning(false)}
        onAction={dispatch}
        onRegenerate={requestRegenerate}
        onToggleLevels={() => dispatch({ type: 'toggle-levels' })}
        onSelect={(id) => dispatch({ type: 'select', id })}
      />
      <div className="scanline-overlay" aria-hidden="true" />
    </main>
  );
}