import { AlertTriangle, RotateCcw } from 'lucide-react';
import { COPY } from '../copy.js';

export function ConfirmDialog({ onCancel, onConfirm }) {
  return (
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
        <h2 id="new-game-warning-title">{COPY.dialog.title}</h2>
        <p id="new-game-warning-copy">{COPY.dialog.body}</p>
        <div className="end-turn-warning-actions">
          <button className="warning-continue-button" onClick={onCancel}>
            {COPY.dialog.stay}
          </button>
          <button className="warning-confirm-button" onClick={onConfirm}>
            <RotateCcw size={15} />
            {COPY.dialog.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}
