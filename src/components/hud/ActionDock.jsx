import { Check, Crosshair, Eye, SkipForward } from 'lucide-react';
import { ActionButton } from './primitives.jsx';
import { selectTargetWindow } from '../../selectors/hud.js';
import { COPY } from '../copy.js';

export function ActionDock({
  state,
  selected,
  target,
  pendingMove,
  pendingMoveCost,
  nextReadyUnit,
  onConfirmMove,
  onRequestEndTurn,
  onAction,
}) {
  const { visible: targetVisible, inRange: targetInRange } = selectTargetWindow(state, selected, target);
  return (
    <footer className={`bottom-dock ${!selected?.ap && !pendingMove ? 'bottom-dock--compact' : ''}`}>
      <div className="action-group">
        {pendingMove && pendingMoveCost ? (
          <ActionButton
            icon={Check}
            label={COPY.dock.confirmMove}
            onClick={onConfirmMove}
            title={COPY.dock.confirmMoveTitle(pendingMoveCost)}
            active
            kind="confirm-move"
          />
        ) : (
          targetVisible && (
            <ActionButton
              icon={Crosshair}
              label={COPY.dock.fire}
              title={targetInRange ? undefined : COPY.dock.outOfRange}
              active={state.shootMode && targetInRange}
              onClick={() => onAction({ type: 'attack', id: target.id })}
              disabled={state.phase !== 'player' || !selected?.ap || !targetInRange}
              kind="fire-action"
            />
          )
        )}
        <ActionButton
          icon={Eye}
          label={COPY.dock.overwatch}
          hint={COPY.dock.overwatchHint}
          onClick={() => onAction({ type: 'ability', name: 'overwatch' })}
          disabled={state.phase !== 'player' || !selected?.ap}
        />
      </div>
      <div className="dock-end">
        <button className="end-turn-button" onClick={onRequestEndTurn} disabled={state.phase !== 'player'}>
          <SkipForward size={16} />
          <span>{nextReadyUnit ? COPY.dock.nextUnit : COPY.dock.endTurn}</span>
          <kbd>{COPY.dock.enterKey}</kbd>
        </button>
      </div>
    </footer>
  );
}
