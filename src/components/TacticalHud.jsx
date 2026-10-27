import { useState } from 'react';
import { ChevronDown, Radio } from 'lucide-react';
import { selectFlankedBy } from '../selectors/hud.js';
import { COPY } from './copy.js';
import { TopBar } from './hud/TopBar.jsx';
import { MissionPanel } from './hud/MissionPanel.jsx';
import { SquadPanel } from './hud/SquadPanel.jsx';
import { PositionPanel } from './hud/PositionPanel.jsx';
import { CombatPreview } from './hud/CombatPreview.jsx';
import { CommsLog } from './hud/CommsLog.jsx';
import { ActionDock } from './hud/ActionDock.jsx';
import { TouchControls } from './hud/TouchControls.jsx';
import { ConfirmDialog } from './hud/ConfirmDialog.jsx';
import { MapLegend, MapCoordinates } from './hud/MapOverlays.jsx';

// Composition only: each panel lives in ./hud/. Panel open state stays here because the
// enemy-phase early return unmounts the panels and must not reset them.
export function TacticalHud({
  state,
  selected,
  target,
  hasShootableEnemy,
  seedCopied,
  onCopySeed,
  pendingMove,
  pendingMoveCost,
  pendingCover,
  nextReadyUnit,
  onConfirmMove,
  onRequestEndTurn,
  showNewGameWarning,
  onConfirmRegenerate,
  onCancelRegenerate,
  onAction,
  onRequestRegenerate,
  onRotateCamera,
  onToggleLevels,
  onSelect,
}) {
  const [stackOpen, setStackOpen] = useState(() => window.innerWidth > 900);
  const [missionOpen, setMissionOpen] = useState(() => window.innerWidth > 900);
  if (state.phase === 'enemy') {
    return (
      <div className="hud-layer">
        <div className="enemy-turn-banner" role="status" aria-live="polite">
          <Radio size={15} />
          {COPY.tactical.enemyTurn}
        </div>
      </div>
    );
  }
  return (
    <div className="hud-layer">
      <TopBar
        state={state}
        onToggleLevels={onToggleLevels}
        onRotateCamera={onRotateCamera}
        onRequestRegenerate={onRequestRegenerate}
      />

      <MissionPanel state={state} open={missionOpen} onToggle={() => setMissionOpen((open) => !open)} />

      <div className={`right-stack ${stackOpen ? '' : 'is-collapsed'}`}>
        <button
          className="stack-toggle"
          aria-expanded={stackOpen}
          aria-controls="einsatz-stack-body"
          onClick={() => setStackOpen((open) => !open)}
        >
          <span>{COPY.stack.toggle}</span>
          <ChevronDown size={14} className="stack-chevron" />
        </button>
        <div id="einsatz-stack-body" className="stack-body">
          <SquadPanel
            unit={selected}
            onSelect={onSelect}
            units={state.units}
            flankedBy={selectFlankedBy(state, selected)}
            canSwitch={state.phase === 'player'}
          />
          {pendingMove && <PositionPanel cover={pendingCover} pendingMoveCost={pendingMoveCost} />}
          <CombatPreview shooter={selected} target={target} state={state} hasShootableEnemy={hasShootableEnemy} />
          <CommsLog entries={state.logs} />
        </div>
      </div>

      <ActionDock
        state={state}
        selected={selected}
        target={target}
        pendingMove={pendingMove}
        pendingMoveCost={pendingMoveCost}
        nextReadyUnit={nextReadyUnit}
        onConfirmMove={onConfirmMove}
        onRequestEndTurn={onRequestEndTurn}
        onAction={onAction}
      />

      <TouchControls
        state={state}
        nextReadyUnit={nextReadyUnit}
        onRotateCamera={onRotateCamera}
        onToggleLevels={onToggleLevels}
        onRequestEndTurn={onRequestEndTurn}
      />
      {showNewGameWarning && <ConfirmDialog onCancel={onCancelRegenerate} onConfirm={onConfirmRegenerate} />}
      {pendingMove && <MapLegend />}
      <MapCoordinates state={state} seedCopied={seedCopied} onCopySeed={onCopySeed} />
    </div>
  );
}
