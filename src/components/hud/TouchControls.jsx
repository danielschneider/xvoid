import { Layers3, RotateCcw, SkipForward } from 'lucide-react';

export function TouchControls({ state, nextReadyUnit, onRotateCamera, onToggleLevels, onRequestEndTurn }) {
  return (
    <div className="touch-controls">
      <button aria-label="Kamera drehen" title="Kamera drehen" onClick={() => onRotateCamera(-1)}>
        <RotateCcw size={17} />
      </button>
      <button aria-label="Etagen umschalten" title="Etagen umschalten" onClick={onToggleLevels}>
        <Layers3 size={17} />
      </button>
      <button
        aria-label={nextReadyUnit ? 'Nächste Einheit' : 'Zug beenden'}
        title={nextReadyUnit ? 'Nächste Einheit' : 'Zug beenden'}
        onClick={onRequestEndTurn}
        disabled={state.phase !== 'player'}
      >
        <SkipForward size={17} />
      </button>
    </div>
  );
}
