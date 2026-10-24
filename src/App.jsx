import { useEffect, useMemo, useReducer, useState } from 'react';
import GameScene from './components/GameScene.jsx';
import { TacticalHud } from './components/TacticalHud.jsx';
import { cellKey, createInitialState, gameReducer, getReachable } from './engine/game.js';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState());
  const [pendingMove, setPendingMove] = useState(null);
  const selected = state.units.find((unit) => unit.id === state.selectedId && unit.hp > 0);
  const target = state.units.find((unit) => unit.id === state.targetId && unit.hp > 0);

  const paths = useMemo(() => {
    if (!selected || selected.team !== 'player' || !state.moveMode || selected.ap < 1) return new Map();
    const blocked = new Set(state.units.filter((unit) => unit.id !== selected.id && unit.hp > 0).map(cellKey));
    return getReachable(state.map, selected, blocked, selected.ap === 1 ? 5 : 10);
  }, [selected, state.map, state.moveMode, state.units]);
  const pendingPath = pendingMove ? paths.get(cellKey(pendingMove)) : null;

  useEffect(() => {
    if (pendingMove && !pendingPath) setPendingMove(null);
  }, [pendingMove, pendingPath]);

  useEffect(() => {
    if (!state.lastShot) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'clear-shot' }), 720);
    return () => window.clearTimeout(timer);
  }, [state.lastShot]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape') setPendingMove(null);
      if (key === 'm') dispatch({ type: 'toggle-move-mode' });
      if (key === 'f' && target) dispatch({ type: 'attack', id: target.id });
      if (key === 'o') dispatch({ type: 'ability', name: 'overwatch' });
      if (key === 'h') dispatch({ type: 'ability', name: 'hunker' });
      if (event.key === 'Enter') dispatch({ type: 'end-turn' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedId, target]);

  const tapCell = (cell) => {
    const occupant = state.units.find((unit) => unit.x === cell.x && unit.z === cell.z && unit.level === cell.level && unit.hp > 0);
    if (occupant?.team === 'player') {
      setPendingMove(null);
      dispatch({ type: 'select', id: occupant.id });
      return;
    }
    if (occupant?.team === 'alien') {
      setPendingMove(null);
      if (occupant.id === state.targetId) dispatch({ type: 'attack', id: occupant.id });
      else dispatch({ type: 'target', id: occupant.id });
      return;
    }
    if (state.moveMode && paths.has(cellKey(cell))) {
      setPendingMove(cell);
      return;
    }
    setPendingMove(null);
  };

  const confirmMove = () => {
    if (!pendingMove || !pendingPath || !selected || pendingPath.apCost > selected.ap) return;
    dispatch({ type: 'move', destination: pendingMove });
    setPendingMove(null);
  };

  const regenerate = () => dispatch({ type: 'regenerate', seed: Math.floor(Math.random() * 900000) + 100000 });

  return (
    <main className="game-shell">
      <div className="scene-wrap"><GameScene state={state} selected={selected} paths={paths} pendingMove={pendingMove} onCellTap={tapCell} /></div>
      <TacticalHud
        state={state}
        selected={selected}
        target={target}
        moveMode={state.moveMode}
        pendingMove={pendingMove}
        pendingMoveCost={pendingPath?.apCost}
        onConfirmMove={confirmMove}
        onAction={dispatch}
        onRegenerate={regenerate}
        onToggleLevels={() => dispatch({ type: 'toggle-levels' })}
        onSelect={(id) => dispatch({ type: 'select', id })}
      />
      <div className="scanline-overlay" aria-hidden="true" />
    </main>
  );
}