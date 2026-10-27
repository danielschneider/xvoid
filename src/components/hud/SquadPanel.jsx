import { AlertTriangle, Eye, HeartPulse, Shield, Zap } from 'lucide-react';
import { HealthBar } from './primitives.jsx';

// Single source for the squad: operative tabs for selection, detail stats for the selected unit.
export function SquadPanel({ unit, onSelect, units, flankedBy, canSwitch }) {
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
