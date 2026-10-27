import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  Crosshair,
  ChevronDown,
  Eye,
  Footprints,
  HeartPulse,
  Layers3,
  Radio,
  RotateCcw,
  Shield,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Swords,
  Target,
  Zap,
} from 'lucide-react';
import { getFlankedBy, SHOT_RANGE } from '../engine/game.js';
import { selectCombatPreview } from '../selectors/combatPreview.js';
import { hasLineOfSight } from '../engine/map.js';

function ActionButton({ icon: Icon, label, hint, onClick, disabled = false, active = false, kind = '', title }) {
  return (
    <button
      className={`action-button ${active ? 'is-active' : ''} ${kind}`}
      onClick={onClick}
      disabled={disabled}
      title={title || `${label}${hint ? ` · ${hint}` : ''}`}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
}

function HealthBar({ value, total, tone = 'mint' }) {
  return (
    <div className={`health-bar ${tone}`} aria-label={`${value} von ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < value ? 'filled' : ''} />
      ))}
    </div>
  );
}

// Single source for the squad: operative tabs for selection, detail stats for the selected unit.
export function UnitPanel({ unit, onSelect, units, flankedBy, canSwitch }) {
  const operatives = units.filter((entry) => entry.team === 'player');
  const alive = operatives.filter((entry) => entry.hp > 0).length;
  return (
    <section className="unit-panel">
      <div className="panel-eyebrow">
        <span className="status-dot" /> EINSATZTEAM{' '}
        <span className="panel-index">
          {alive} / {operatives.length}
        </span>
      </div>
      <div className="operative-tabs" role="group" aria-label="Operative auswählen">
        {operatives.map((operative, index) => (
          <button
            key={operative.id}
            type="button"
            onClick={() => onSelect(operative.id)}
            disabled={!canSwitch || operative.hp <= 0}
            aria-pressed={operative.id === unit?.id}
            title={`${operative.name} · ${operative.className}`}
            className={`operative-tab ${operative.id === unit?.id ? 'is-selected' : ''} ${operative.hp <= 0 ? 'is-fallen' : ''}`}
          >
            <span className="op-number">0{index + 1}</span>
            <span className="op-avatar" style={{ '--unit-color': operative.color }}>
              {operative.className.slice(0, 1)}
            </span>
            <span className="op-hp">{operative.hp}</span>
          </button>
        ))}
      </div>
      {unit ? (
        <>
          <div className="unit-main">
            <div className="unit-avatar" style={{ '--unit-color': unit.color }}>
              {unit.className.slice(0, 2)}
            </div>
            <div className="unit-title">
              <h2>{unit.name}</h2>
              <p>
                {unit.className} <span>· L{unit.level}</span>
              </p>
            </div>
            <div className="ap-inline" aria-label={`${unit.ap} Aktionspunkte`} title="Aktions-Punkte">
              {[0, 1].map((point) => (
                <i key={point} className={point < unit.ap ? 'ap-filled' : ''}>
                  <Zap size={11} fill="currentColor" />
                </i>
              ))}
            </div>
          </div>
          <div className="stat-row">
            <span>
              <HeartPulse size={13} /> VITAL
            </span>
            <HealthBar value={unit.hp} total={unit.maxHp} />
            <b>
              {unit.hp}/{unit.maxHp}
              <em className="shield-value">
                <Shield size={10} /> {unit.shield}/2
              </em>
            </b>
          </div>
          {unit.status && (
            <div className="stance-badge">
              <Eye size={12} /> OVERWATCH
            </div>
          )}
          {flankedBy?.length > 0 && (
            <div className="flank-badge" role="status">
              <AlertTriangle size={12} /> FLANKIERT <span>{flankedBy.map((enemy) => enemy.name).join(', ')}</span>
            </div>
          )}
        </>
      ) : (
        <p className="empty-note">Keine Einheit ausgewählt</p>
      )}
    </section>
  );
}

export function CombatPreview({ shooter, target, state, hasShootableEnemy }) {
  const preview = selectCombatPreview(state, shooter, target);
  if (!preview)
    return (
      <section className={`combat-preview idle-preview ${hasShootableEnemy ? 'shootable-preview' : ''}`}>
        <div className="preview-reticle">
          <Crosshair size={19} />
        </div>
        <div>
          <strong>{hasShootableEnemy ? 'FEIND IM SCHUSSFELD' : 'KEIN ZIEL ERFASST'}</strong>
          <span>{hasShootableEnemy ? 'Gegner antippen, dann Feuern drücken' : 'Wähle eine feindliche Einheit'}</span>
        </div>
      </section>
    );
  const {
    visible,
    flanked,
    inRange,
    distance,
    hitPercent: hit,
    coverPercent,
    elevationPercent: elevation,
    distancePercent: distanceModifier,
    basePercent,
  } = preview;
  const coverPenalty = coverPercent;
  return (
    <section className="combat-preview">
      <div className="preview-target">
        <span className="target-icon">
          <Target size={17} />
        </span>
        <div>
          <strong>{target.name}</strong>
          <span>
            {visible
              ? `${target.className} · ${Math.round(distance)} M`
              : inRange
                ? 'SCHUSSLINIE BLOCKIERT'
                : 'AUSSER REICHWEITE'}
          </span>
        </div>
        <b>{visible ? `${hit}%` : '—'}</b>
      </div>
      <div className="chance-track">
        <i style={{ width: `${hit}%` }} />
      </div>
      {visible && flanked && (
        <div className="flank-warning" role="status">
          <AlertTriangle size={12} /> Flankiert: Deckung entfällt für diesen Schuss
        </div>
      )}
      <div className="chance-breakdown">
        <span>
          Basis <b>{basePercent}%</b>
        </span>
        <span>
          Deckung <b className={coverPenalty ? 'negative' : ''}>{flanked ? 'FLANKIERT' : `−${coverPenalty}%`}</b>
        </span>
        <span>
          Höhe <b className="positive">+{elevation}%</b>
        </span>
        <span>
          Distanz{' '}
          <b className={distanceModifier > 0 ? 'positive' : distanceModifier < 0 ? 'negative' : ''}>
            {distanceModifier > 0 ? '+' : ''}
            {distanceModifier}%
          </b>
        </span>
      </div>
    </section>
  );
}

const SIDE_LABEL = { N: 'Nord', E: 'Ost', S: 'Süd', W: 'West' };
const TIER_LABEL = { 2: 'voll', 1: 'halb', 0: 'offen' };

// Cover of a cell per side. Shown for the destination the player is about to confirm,
// so the protection is known before the move is spent.
export function PositionPanel({ cover, pendingMoveCost }) {
  if (!cover) return null;
  const open = Object.entries(cover.sides)
    .filter(([, tier]) => tier === 0)
    .map(([side]) => SIDE_LABEL[side]);
  return (
    <section className="position-panel" aria-label="Deckung der Zielposition">
      <div className="position-heading">
        <span>
          <ShieldCheck size={12} /> ZIELPOSITION
        </span>
        <b className={`cover-${cover.label}`}>
          {cover.label === 'full' ? 'VOLLE DECKUNG' : cover.label === 'half' ? 'HALBE DECKUNG' : 'KEINE DECKUNG'}
        </b>
      </div>
      <div className="position-sides">
        {Object.entries(cover.sides).map(([side, tier]) => (
          <span key={side} className={`side-cell cover-${tier === 2 ? 'full' : tier === 1 ? 'half' : 'open'}`}>
            <small>{SIDE_LABEL[side]}</small>
            <b>{TIER_LABEL[tier]}</b>
          </span>
        ))}
      </div>
      <p className="position-note">
        {open.length > 0 ? `Offen: ${open.join(', ')} · Angriffe von dort flankieren` : 'Von allen Seiten gedeckt'}
        {pendingMoveCost ? ` · ${pendingMoveCost} AP` : ''}
      </p>
    </section>
  );
}

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
  const livingEnemies = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).length;
  const totalEnemies = state.units.filter((unit) => unit.team === 'alien').length;
  const eliminatedEnemies = totalEnemies - livingEnemies;
  const targetVisible = selected && target && hasLineOfSight(state.map, selected, target);
  const targetInRange = targetVisible && Math.hypot(selected.x - target.x, selected.z - target.z) <= SHOT_RANGE;
  if (state.phase === 'enemy') {
    return (
      <div className="hud-layer">
        <div className="enemy-turn-banner" role="status" aria-live="polite">
          <Radio size={15} /> ENEMY TURN
        </div>
      </div>
    );
  }
  return (
    <div className="hud-layer">
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
            <span>{String(livingEnemies).padStart(2, '0')}</span> HOSTILES
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

      <aside className={`left-rail ${missionOpen ? '' : 'is-collapsed'}`}>
        <button
          className="mission-toggle"
          aria-expanded={missionOpen}
          aria-controls="mission-status-body"
          onClick={() => setMissionOpen((open) => !open)}
        >
          <span className="mission-label">
            <Radio size={13} />
            <span>MISSION STATUS</span>
          </span>
          <ChevronDown size={14} className="stack-chevron" />
        </button>
        <div id="mission-status-body" className="mission-body">
          <p className="mission-objective">Eliminiere feindliche Kräfte.</p>
          <div className="objective-meter">
            <i style={{ width: `${(eliminatedEnemies / totalEnemies) * 100}%` }} />
          </div>
          <div className="objective-count">
            <span>HOSTILES ELIMINIERT</span>
            <b>
              {eliminatedEnemies} / {totalEnemies}
            </b>
          </div>
        </div>
      </aside>

      <div className={`right-stack ${stackOpen ? '' : 'is-collapsed'}`}>
        <button
          className="stack-toggle"
          aria-expanded={stackOpen}
          aria-controls="einsatz-stack-body"
          onClick={() => setStackOpen((open) => !open)}
        >
          <span>EINSATZSYSTEM</span>
          <ChevronDown size={14} className="stack-chevron" />
        </button>
        <div id="einsatz-stack-body" className="stack-body">
          <UnitPanel
            unit={selected}
            onSelect={onSelect}
            units={state.units}
            flankedBy={selected ? getFlankedBy(state, selected) : []}
            canSwitch={state.phase === 'player'}
          />
          {pendingMove && <PositionPanel cover={pendingCover} pendingMoveCost={pendingMoveCost} />}
          <CombatPreview shooter={selected} target={target} state={state} hasShootableEnemy={hasShootableEnemy} />
          <section className="battle-log">
            <div className="log-heading">
              <span>COMMS LOG</span>
              <span className="log-live">LIVE</span>
            </div>
            {state.logs.slice(0, 3).map((entry) => (
              <p key={entry.id} className={`log-entry ${entry.kind}`}>
                <i />
                {entry.text}
              </p>
            ))}
          </section>
        </div>
      </div>

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
      {showNewGameWarning && (
        <div className="end-turn-warning-backdrop">
          <section
            className="end-turn-warning"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="new-game-warning-title"
            aria-describedby="new-game-warning-copy"
          >
            <div className="end-turn-warning-icon">
              <AlertTriangle size={20} />
            </div>
            <h2 id="new-game-warning-title">NEUES SPIEL STARTEN</h2>
            <p id="new-game-warning-copy">
              Der aktuelle Einsatz geht verloren. Karte, Einheiten und Fortschritt werden neu generiert. Fortfahren?
            </p>
            <div className="end-turn-warning-actions">
              <button className="warning-continue-button" onClick={onCancelRegenerate}>
                WEITER SPIELEN
              </button>
              <button className="warning-confirm-button" onClick={onConfirmRegenerate}>
                <RotateCcw size={15} /> NEUES SPIEL
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingMove && (
        <div className="map-legend" aria-label="Deckungsfarben">
          <span>
            <i style={{ background: '#4aa8ff' }} />
            voll
          </span>
          <span>
            <i style={{ background: '#7fe08a' }} />
            halb
          </span>
          <span>
            <i style={{ background: '#8c9a94' }} />
            offen
          </span>
        </div>
      )}
      <div className="map-coordinates">
        <span>
          {state.map.size} × {state.map.size}
        </span>
        <i /> PROC-GEN{' '}
        <span className="seed-group">
          <i />
          <span>SEED {state.map.seed}</span>
          <button
            className="seed-copy-button"
            onClick={onCopySeed}
            aria-label="Kartenseed kopieren"
            title={seedCopied ? 'Seed kopiert' : 'Seed kopieren'}
          >
            {seedCopied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </span>
      </div>
    </div>
  );
}
