import { Check, Crosshair, Eye, SkipForward } from 'lucide-react';
import { ActionButton } from './primitives.jsx';
import { selectTargetWindow } from '../../selectors/hud.js';

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
            label="Bewegen"
            onClick={onConfirmMove}
            title={`Bewegung für ${pendingMoveCost} AP bestätigen`}
            active
            kind="confirm-move"
          />
        ) : (
          targetVisible && (
            <ActionButton
              icon={Crosshair}
              label="Feuern"
              title={targetInRange ? undefined : 'Ziel außer Reichweite'}
              active={state.shootMode && targetInRange}
              onClick={() => onAction({ type: 'attack', id: target.id })}
              disabled={state.phase !== 'player' || !selected?.ap || !targetInRange}
              kind="fire-action"
            />
          )
        )}
        <ActionButton
          icon={Eye}
          label="Feuerschutz"
          hint="O"
          onClick={() => onAction({ type: 'ability', name: 'overwatch' })}
          disabled={state.phase !== 'player' || !selected?.ap}
        />
      </div>
      <div className="dock-end">
        <button className="end-turn-button" onClick={onRequestEndTurn} disabled={state.phase !== 'player'}>
          <SkipForward size={16} />
          <span>{nextReadyUnit ? 'NÄCHSTE' : 'ZUG BEENDEN'}</span>
          <kbd>↵</kbd>
        </button>
      </div>
    </footer>
  );
}
