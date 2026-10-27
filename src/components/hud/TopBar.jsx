import { Activity, Layers3, RotateCcw, Sparkles } from 'lucide-react';
import { selectEnemyCounts } from '../../selectors/hud.js';

export function TopBar({ state, onToggleLevels, onRotateCamera, onRequestRegenerate }) {
  const { living } = selectEnemyCounts(state);
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <span className="brand-mark">
          <Activity size={17} />
        </span>
        <span className="brand-name">XVOID</span>
        <span className="brand-separator" />
        <span className="brand-mode">TACTICAL OPERATIONS</span>
      </div>
      <div className="mission-meta">
        <span className="live-indicator" /> <span>SEKTOR 07 / NEMESIS</span>
        <i /> <span>R-{String(state.turn).padStart(2, '0')}</span>
      </div>
      <div className="top-actions">
        <span className="enemy-count">
          <span>{String(living).padStart(2, '0')}</span> HOSTILES
        </span>
        <button
          className="icon-button level-toggle"
          onClick={onToggleLevels}
          title={state.showUpper ? 'Obere Etagen ausblenden' : 'Obere Etagen einblenden'}
        >
          <Layers3 size={17} />
          <span>{state.showUpper ? 'ALLE LEVEL' : 'LEVEL 0'}</span>
        </button>
        <button
          className="icon-button tablet-rotate-button"
          aria-label="Kamera drehen"
          title="Kamera drehen"
          onClick={() => onRotateCamera(-1)}
        >
          <RotateCcw size={16} />
        </button>
        <button className="icon-button regenerate-button" onClick={onRequestRegenerate} title="Karte neu generieren">
          <Sparkles size={16} />
        </button>
      </div>
    </header>
  );
}
