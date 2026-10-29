import { Activity, Layers3, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import { selectEnemyCounts } from '../../selectors/hud.ts';
import { COPY } from '../copy.js';

export function TopBar({ state, onToggleLevels, onRotateCamera, onRequestRegenerate, roundsBack, onUndoRound }) {
  const { living } = selectEnemyCounts(state);
  const canUndo = roundsBack > 0 && state.phase === 'player' && !state.movement;
  const undoTitle = !canUndo ? COPY.topBar.undoRoundDisabled : COPY.topBar.undoRoundTitle(roundsBack);
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <span className="brand-mark">
          <Activity size={17} />
        </span>
        <span className="brand-name">{COPY.topBar.brandName}</span>
        <span className="brand-separator" />
        <span className="brand-mode">{COPY.topBar.brandMode}</span>
      </div>
      <div className="mission-meta">
        <span className="live-indicator" /> <span>{COPY.topBar.mission}</span>
        <i /> <span>{COPY.topBar.round(state.turn)}</span>
      </div>
      <div className="top-actions">
        <span className="enemy-count">
          <span>{String(living).padStart(2, '0')}</span>
          {COPY.topBar.hostiles}
        </span>
        <button
          className="icon-button level-toggle"
          onClick={onToggleLevels}
          title={state.showUpper ? COPY.topBar.levelsHide : COPY.topBar.levelsShow}
        >
          <Layers3 size={17} />
          <span>{state.showUpper ? COPY.topBar.allLevels : COPY.topBar.levelZero}</span>
        </button>
        <button
          className="icon-button tablet-rotate-button"
          aria-label={COPY.topBar.cameraRotate}
          title={COPY.topBar.cameraRotate}
          onClick={() => onRotateCamera(-1)}
        >
          <RotateCcw size={16} />
        </button>
        <button
          className="icon-button undo-round-button"
          onClick={onUndoRound}
          disabled={!canUndo}
          title={undoTitle}
          aria-label={undoTitle}
        >
          <Undo2 size={16} />
          <span>{COPY.topBar.undoRound}</span>
        </button>
        <button className="icon-button regenerate-button" onClick={onRequestRegenerate} title={COPY.topBar.regenerate}>
          <Sparkles size={16} />
        </button>
      </div>
    </header>
  );
}
