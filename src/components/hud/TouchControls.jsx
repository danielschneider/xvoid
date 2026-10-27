import { Layers3, RotateCcw, SkipForward } from 'lucide-react';
import { COPY } from '../copy.js';

export function TouchControls({ state, nextReadyUnit, onRotateCamera, onToggleLevels, onRequestEndTurn }) {
  return (
    <div className="touch-controls">
      <button aria-label={COPY.touch.cameraRotate} title={COPY.touch.cameraRotate} onClick={() => onRotateCamera(-1)}>
        <RotateCcw size={17} />
      </button>
      <button aria-label={COPY.touch.levels} title={COPY.touch.levels} onClick={onToggleLevels}>
        <Layers3 size={17} />
      </button>
      <button
        aria-label={nextReadyUnit ? COPY.touch.nextUnit : COPY.touch.endTurn}
        title={nextReadyUnit ? COPY.touch.nextUnit : COPY.touch.endTurn}
        onClick={onRequestEndTurn}
        disabled={state.phase !== 'player'}
      >
        <SkipForward size={17} />
      </button>
    </div>
  );
}
