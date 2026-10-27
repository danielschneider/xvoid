import { ShieldCheck } from 'lucide-react';
import { COPY } from '../copy.js';

const SIDE_LABEL = COPY.position.sides;
const TIER_LABEL = COPY.position.tiers;

// Cover of a cell per side. Shown for the destination the player is about to confirm,
// so the protection is known before the move is spent.
export function PositionPanel({ cover, pendingMoveCost }) {
  if (!cover) return null;
  const open = Object.entries(cover.sides)
    .filter(([, tier]) => tier === 0)
    .map(([side]) => SIDE_LABEL[side]);
  return (
    <section className="position-panel" aria-label={COPY.position.ariaLabel}>
      <div className="position-heading">
        <span>
          <ShieldCheck size={12} />
          {COPY.position.label}
        </span>
        <b className={`cover-${cover.label}`}>
          {cover.label === 'full'
            ? COPY.position.coverFull
            : cover.label === 'half'
              ? COPY.position.coverHalf
              : COPY.position.coverNone}
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
        {open.length > 0 ? COPY.position.openSides(open) : COPY.position.allCovered}
        {pendingMoveCost ? COPY.position.apSuffix(pendingMoveCost) : ''}
      </p>
    </section>
  );
}
