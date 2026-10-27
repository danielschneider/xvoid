import { AlertTriangle, Crosshair, Target } from 'lucide-react';
import { selectCombatPreview } from '../../selectors/combatPreview.js';
import { COPY } from '../copy.js';

export function CombatPreview({ shooter, target, state, hasShootableEnemy }) {
  const preview = selectCombatPreview(state, shooter, target);
  if (!preview)
    return (
      <section className={`combat-preview idle-preview ${hasShootableEnemy ? 'shootable-preview' : ''}`}>
        <div className="preview-reticle">
          <Crosshair size={19} />
        </div>
        <div>
          <strong>{hasShootableEnemy ? COPY.combat.shootable : COPY.combat.noTarget}</strong>
          <span>{hasShootableEnemy ? COPY.combat.shootableHint : COPY.combat.noTargetHint}</span>
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
              ? COPY.combat.targetMeta(target.className, distance)
              : inRange
                ? COPY.combat.blocked
                : COPY.combat.outOfRange}
          </span>
        </div>
        <b>{visible ? `${hit}%` : COPY.combat.hidden}</b>
      </div>
      <div className="chance-track">
        <i style={{ width: `${hit}%` }} />
      </div>
      {visible && flanked && (
        <div className="flank-warning" role="status">
          <AlertTriangle size={12} />
          {COPY.combat.flankWarning}
        </div>
      )}
      <div className="chance-breakdown">
        <span>
          {COPY.combat.base}
          <b>{basePercent}%</b>
        </span>
        <span>
          {COPY.combat.cover}
          <b className={coverPenalty ? 'negative' : ''}>
            {flanked ? COPY.shared.flanked : COPY.combat.coverValue(coverPenalty)}
          </b>
        </span>
        <span>
          {COPY.combat.height}
          <b className="positive">+{elevation}%</b>
        </span>
        <span>
          {COPY.combat.distance}{' '}
          <b className={distanceModifier > 0 ? 'positive' : distanceModifier < 0 ? 'negative' : ''}>
            {distanceModifier > 0 ? '+' : ''}
            {distanceModifier}%
          </b>
        </span>
      </div>
    </section>
  );
}
