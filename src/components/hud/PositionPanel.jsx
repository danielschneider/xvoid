import { ShieldCheck } from 'lucide-react';

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
