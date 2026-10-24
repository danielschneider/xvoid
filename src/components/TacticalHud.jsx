import {
  Activity, AlertTriangle, Check, Crosshair, Eye, HeartPulse, Layers3, Move, Radio, RotateCcw,
  Shield, ShieldCheck, SkipForward, Swords, Target, Zap,
} from 'lucide-react';
import { hasLineOfSight } from '../engine/map.js';

function ActionButton({ icon: Icon, label, hint, onClick, disabled = false, active = false, kind = '', title }) {
  return (
    <button className={`action-button ${active ? 'is-active' : ''} ${kind}`} onClick={onClick} disabled={disabled} title={title || `${label}${hint ? ` · ${hint}` : ''}`}>
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
}

function HealthBar({ value, total, tone = 'mint' }) {
  return (
    <div className={`health-bar ${tone}`} aria-label={`${value} von ${total}`}>
      {Array.from({ length: total }, (_, index) => <i key={index} className={index < value ? 'filled' : ''} />)}
    </div>
  );
}

export function UnitPanel({ unit, onSelect, units }) {
  const allies = units.filter((entry) => entry.team === 'player');
  if (!unit) return <section className="unit-panel empty-panel">Keine Einheit ausgewählt</section>;
  return (
    <section className="unit-panel">
      <div className="panel-eyebrow"><span className="status-dot" /> EINSATZTEAM <span className="panel-index">0{allies.indexOf(unit) + 1}</span></div>
      <div className="unit-main">
        <div className="unit-avatar" style={{ '--unit-color': unit.color }}>{unit.className.slice(0, 2)}</div>
        <div className="unit-title"><h2>{unit.name}</h2><p>{unit.className} <span>· L{unit.level}</span></p></div>
        <button className="icon-button switch-unit" title="Nächste Einheit" onClick={() => onSelect(allies[(allies.indexOf(unit) + 1) % allies.length].id)}><RotateCcw size={16} /></button>
      </div>
      <div className="stat-row"><span><HeartPulse size={13} /> VITALITÄT</span><HealthBar value={unit.hp} total={unit.maxHp} /><b>{unit.hp}/{unit.maxHp}</b></div>
      <div className="stat-row"><span><Shield size={13} /> SCHILD</span><HealthBar value={unit.shield} total={2} tone="blue" /><b>{unit.shield}/2</b></div>
      <div className="ap-row"><span>AKTIONS-PUNKTE</span><div>{[0, 1].map((point) => <i key={point} className={point < unit.ap ? 'ap-filled' : ''}><Zap size={12} fill="currentColor" /></i>)}</div></div>
    </section>
  );
}

export function CombatPreview({ shooter, target, map, hasShootableEnemy }) {
  if (!shooter || !target) return <section className={`combat-preview idle-preview ${hasShootableEnemy ? 'shootable-preview' : ''}`}><div className="preview-reticle"><Crosshair size={19} /></div><div><strong>{hasShootableEnemy ? 'FEIND IM SCHUSSFELD' : 'KEIN ZIEL ERFASST'}</strong><span>{hasShootableEnemy ? 'Gegner antippen, dann Feuern drücken' : 'Wähle eine feindliche Einheit'}</span></div></section>;
  const dx = shooter.x - target.x;
  const dz = shooter.z - target.z;
  const distance = Math.hypot(dx, dz);
  const visible = hasLineOfSight(map, shooter, target);
  const cover = map.cells[`${target.x},${target.z},${target.level}`]?.cover || 0;
  const coverPenalty = cover === 2 ? 40 : cover === 1 ? 20 : 0;
  const elevation = shooter.level > target.level ? 15 : 0;
  const distancePenalty = Math.round(Math.max(0, distance - 8) * 1.5);
  const hit = visible ? Math.max(5, Math.min(95, 70 + elevation - coverPenalty - distancePenalty)) : 0;
  return (
    <section className="combat-preview">
      <div className="preview-target"><span className="target-icon"><Target size={17} /></span><div><strong>{target.name}</strong><span>{visible ? `${target.className} · ${Math.round(distance)} M` : 'SCHUSSLINIE BLOCKIERT'}</span></div><b>{visible ? `${hit}%` : '—'}</b></div>
      <div className="chance-track"><i style={{ width: `${hit}%` }} /></div>
      <div className="chance-breakdown"><span>Basis <b>70%</b></span><span>Deckung <b className={coverPenalty ? 'negative' : ''}>−{coverPenalty}%</b></span><span>Höhe <b className="positive">+{elevation}%</b></span><span>Distanz <b className={distancePenalty ? 'negative' : ''}>−{distancePenalty}%</b></span></div>
    </section>
  );
}

export function TacticalHud({ state, selected, target, hasShootableEnemy, moveMode, pendingMove, pendingMoveCost, remainingAP, showEndTurnWarning, onConfirmMove, onRequestEndTurn, onConfirmEndTurn, onCancelEndTurn, onAction, onRegenerate, onToggleLevels, onSelect }) {
  const livingEnemies = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).length;
  const totalEnemies = state.units.filter((unit) => unit.team === 'alien').length;
  const eliminatedEnemies = totalEnemies - livingEnemies;
  const targetVisible = selected && target && hasLineOfSight(state.map, selected, target);
  return (
    <div className="hud-layer">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark"><Activity size={17} /></span><span className="brand-name">XVOID</span><span className="brand-separator" /><span className="brand-mode">TACTICAL OPERATIONS</span></div>
        <div className="mission-meta"><span className="live-indicator" /> <span>SEKTOR 07 / NEMESIS</span><i /> <span>R-{String(state.turn).padStart(2, '0')}</span></div>
        <div className="top-actions"><span className="enemy-count"><span>{String(livingEnemies).padStart(2, '0')}</span> HOSTILES</span><button className="icon-button level-toggle" onClick={onToggleLevels} title={state.showUpper ? 'Obere Etagen ausblenden' : 'Obere Etagen einblenden'}><Layers3 size={17} /><span>{state.showUpper ? 'ALLE LEVEL' : 'LEVEL 0'}</span></button><button className="icon-button regenerate-button" onClick={onRegenerate} title="Karte neu generieren"><RotateCcw size={16} /></button></div>
      </header>
      {state.phase === 'enemy' && <div className="enemy-turn-banner" role="status" aria-live="polite"><Radio size={15} /> ENEMY TURN</div>}

      <aside className="left-rail">
        <div className="rail-heading"><span>OPERATIVES</span><b>{state.units.filter((unit) => unit.team === 'player' && unit.hp > 0).length} / 3</b></div>
        {state.units.filter((unit) => unit.team === 'player').map((unit, index) => (
          <button key={unit.id} onClick={() => onSelect(unit.id)} disabled={state.phase !== 'player' || unit.hp <= 0} className={`roster-unit ${unit.id === selected?.id ? 'selected' : ''} ${unit.hp <= 0 ? 'fallen' : ''}`}>
            <span className="roster-number">0{index + 1}</span><span className="roster-avatar" style={{ '--unit-color': unit.color }}>{unit.className.slice(0, 1)}</span><span className="roster-copy"><b>{unit.name}</b><small>{unit.className}</small></span><span className="roster-health">{unit.hp}<i>/ {unit.maxHp}</i></span>
          </button>
        ))}
        <div className="rail-divider" />
        <div className="mission-label"><Radio size={13} /><span>MISSION STATUS</span></div>
        <p className="mission-objective">Sichere den Knotenpunkt.<br />Eliminiere feindliche Kräfte.</p>
        <div className="objective-meter"><i style={{ width: `${(eliminatedEnemies / totalEnemies) * 100}%` }} /></div>
        <div className="objective-count"><span>HOSTILES ELIMINIERT</span><b>{eliminatedEnemies} / {totalEnemies}</b></div>
      </aside>

      <div className="right-stack">
        <UnitPanel unit={selected} onSelect={onSelect} units={state.units} />
        <CombatPreview shooter={selected} target={target} map={state.map} hasShootableEnemy={hasShootableEnemy} />
        <section className="battle-log"><div className="log-heading"><span>COMMS LOG</span><span className="log-live">LIVE</span></div>{state.logs.slice(0, 3).map((entry) => <p key={entry.id} className={`log-entry ${entry.kind}`}><i />{entry.text}</p>)}</section>
      </div>

      <footer className="bottom-dock">
        <div className="dock-location"><span className="location-cross"><Move size={15} /></span><div><b>GRID {String(selected?.x ?? 0).padStart(2, '0')} : {String(selected?.z ?? 0).padStart(2, '0')}</b><small>DECK {selected?.level ?? 0} · {selected?.level > 0 ? 'ELEVATED' : 'GROUND'}</small></div></div>
        <div className="action-group">
          <ActionButton icon={Move} label="Bewegen" hint="M" active={moveMode} onClick={() => onAction({ type: 'toggle-move-mode' })} disabled={state.phase !== 'player' || !selected?.ap} />
          <ActionButton icon={Crosshair} label="Feuern" onClick={() => target && onAction({ type: 'attack', id: target.id })} disabled={state.phase !== 'player' || !targetVisible || !selected?.ap} kind="fire-action" />
          <ActionButton icon={Eye} label="Overwatch" hint="O" onClick={() => onAction({ type: 'ability', name: 'overwatch' })} disabled={state.phase !== 'player' || !selected?.ap} />
          <ActionButton icon={ShieldCheck} label="Deckung" hint="H" onClick={() => onAction({ type: 'ability', name: 'hunker' })} disabled={state.phase !== 'player' || !selected?.ap} />
          {pendingMove && pendingMoveCost && <ActionButton icon={Check} label="Bestätigen" onClick={onConfirmMove} title={`Bewegung für ${pendingMoveCost} AP bestätigen`} active kind="confirm-move" />}
        </div>
        <div className="dock-end"><button className="end-turn-button" onClick={onRequestEndTurn} disabled={state.phase !== 'player'}><SkipForward size={16} /><span>ZUG BEENDEN</span><kbd>↵</kbd></button></div>
      </footer>

      <div className="touch-controls"><button aria-label="Kamera drehen" title="Kamera drehen" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }))}><RotateCcw size={17} /></button><button aria-label="Etagen umschalten" title="Etagen umschalten" onClick={onToggleLevels}><Layers3 size={17} /></button><button aria-label="Zug beenden" title="Zug beenden" onClick={onRequestEndTurn} disabled={state.phase !== 'player'}><SkipForward size={17} /></button></div>
      {showEndTurnWarning && (
        <div className="end-turn-warning-backdrop">
          <section className="end-turn-warning" role="alertdialog" aria-modal="true" aria-labelledby="end-turn-warning-title" aria-describedby="end-turn-warning-copy">
            <div className="end-turn-warning-icon"><AlertTriangle size={20} /></div>
            <h2 id="end-turn-warning-title">AKTIONSPUNKTE ÜBRIG</h2>
            <p id="end-turn-warning-copy">Deinem Team stehen noch {remainingAP} AP zur Verfügung. Zug trotzdem beenden?</p>
            <div className="end-turn-warning-actions">
              <button className="warning-continue-button" onClick={onCancelEndTurn}>WEITER SPIELEN</button>
              <button className="warning-confirm-button" onClick={onConfirmEndTurn}><SkipForward size={15} /> ZUG BEENDEN</button>
            </div>
          </section>
        </div>
      )}
      <div className="map-coordinates"><span>{state.map.size} × {state.map.size}</span><i /> PROC-GEN <i /> SEED {String(state.map.seed).slice(-5)}</div>
    </div>
  );
}