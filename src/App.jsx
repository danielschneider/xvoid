import { useEffect, useMemo, useReducer, useState } from 'react';
import GameScene from './components/GameScene.jsx';
import { TacticalHud } from './components/TacticalHud.jsx';
import { cellKey, createInitialState, gameReducer, getReachable } from './engine/game.js';
import { getVisibleCells, hasLineOfSight } from './engine/map.js';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState());
  const [pendingMove, setPendingMove] = useState(null);
  const [showEndTurnWarning, setShowEndTurnWarning] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const selected = state.units.find((unit) => unit.id === state.selectedId && unit.hp > 0);
  const target = state.units.find((unit) => unit.id === state.targetId && unit.hp > 0);
  const visibleCellKeys = useMemo(() => getVisibleCells(state.map, state.units), [state.map, state.units]);
  const shootableEnemyIds = useMemo(() => {
    if (!selected || selected.ap < 1) return new Set();
    return new Set(state.units
      .filter((unit) => unit.team === 'alien' && unit.hp > 0)
      .filter((unit) => visibleCellKeys.has(cellKey(unit)) && hasLineOfSight(state.map, selected, unit))
      .map((unit) => unit.id));
  }, [selected, state.map, state.units, visibleCellKeys]);
  const activeEnemy = state.phase === 'enemy'
    ? state.units.find((unit) => unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0)
    : null;
  const focusUnit = state.phase === 'enemy'
    ? (activeEnemy && visibleCellKeys.has(cellKey(activeEnemy)) ? activeEnemy : null)
    : selected;
  const focusToken = state.phase === 'enemy' ? state.enemyTurnIndex : 0;
  const remainingAP = state.units
    .filter((unit) => unit.team === 'player' && unit.hp > 0)
    .reduce((total, unit) => total + unit.ap, 0);
  const requestEndTurn = () => {
    if (state.phase !== 'player' || state.movement) return;
    if (remainingAP > 0) setShowEndTurnWarning(true);
    else dispatch({ type: 'end-turn' });
  };
  const confirmEndTurn = () => {
    setShowEndTurnWarning(false);
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
  const pendingPath = pendingMove ? paths.get(cellKey(pendingMove)) : null;

  useEffect(() => {
    if (pendingMove && !pendingPath) setPendingMove(null);
  }, [pendingMove, pendingPath]);

  useEffect(() => {
    if (!state.lastShot) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'clear-shot' }), state.lastShot.enemyShot ? 1300 : 720);
    return () => window.clearTimeout(timer);
  }, [state.lastShot]);

  useEffect(() => {
    if (state.phase !== 'enemy') return undefined;
    const finished = state.enemyTurnIndex >= state.enemyTurnOrder.length;
    const timer = window.setTimeout(() => {
      dispatch({ type: finished ? 'finish-enemy-turn' : 'enemy-step' });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [state.enemyTurnIndex, state.enemyTurnOrder.length, state.phase]);

  useEffect(() => {
    if (!state.movement) return undefined;
    const timer = window.setTimeout(
      () => dispatch({ type: 'complete-movement', id: state.movement.id }),
      state.movement.path.length * 220 + 80,
    );
    return () => window.clearTimeout(timer);
  }, [state.movement]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPendingMove(null);
        setShowEndTurnWarning(false);
        return;
      }
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'm') dispatch({ type: 'toggle-move-mode' });
      if (key === 'o') dispatch({ type: 'ability', name: 'overwatch' });
      if (key === 'h') dispatch({ type: 'ability', name: 'hunker' });
      if (event.key === 'Enter') requestEndTurn();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestEndTurn, state.selectedId, target]);

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

  const regenerate = () => dispatch({ type: 'regenerate', seed: Math.floor(Math.random() * 900000) + 100000 });

  return (
    <main className="game-shell">
      <div className="scene-wrap"><GameScene state={state} selected={selected} focusUnit={focusUnit} focusToken={focusToken} target={target} paths={paths} pendingMove={pendingMove} visibleCellKeys={visibleCellKeys} shootableEnemyIds={shootableEnemyIds} onCellTap={tapCell} /></div>
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
        remainingAP={remainingAP}
        showEndTurnWarning={showEndTurnWarning}
        onConfirmMove={confirmMove}
        onRequestEndTurn={requestEndTurn}
        onConfirmEndTurn={confirmEndTurn}
        onCancelEndTurn={() => setShowEndTurnWarning(false)}
        onAction={dispatch}
        onRegenerate={regenerate}
        onToggleLevels={() => dispatch({ type: 'toggle-levels' })}
        onSelect={(id) => dispatch({ type: 'select', id })}
      />
      <div className="scanline-overlay" aria-hidden="true" />
    </main>
  );
}