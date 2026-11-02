import { Check } from 'lucide-react';
import { COPY } from '../copy.js';

// Shown once every alien unit is eliminated. The next round is started by the caller after a delay.
export function RoundClearedHint() {
  return (
    <div className="round-cleared-hint" role="status" aria-live="polite">
      <Check size={15} />
      <div>
        <strong>{COPY.roundCleared.title}</strong>
        <span>{COPY.roundCleared.next}</span>
      </div>
    </div>
  );
}
