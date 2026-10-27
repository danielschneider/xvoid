import { AlertTriangle, Crosshair, Target } from 'lucide-react';
import { selectCombatPreview } from '../../selectors/combatPreview.js';

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
