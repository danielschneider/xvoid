import { AlertTriangle, RotateCcw } from 'lucide-react';

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
        <h2 id="new-game-warning-title">NEUES SPIEL STARTEN</h2>
        <p id="new-game-warning-copy">
          Der aktuelle Einsatz geht verloren. Karte, Einheiten und Fortschritt werden neu generiert. Fortfahren?
        </p>
        <div className="end-turn-warning-actions">
          <button className="warning-continue-button" onClick={onCancel}>
            WEITER SPIELEN
          </button>
          <button className="warning-confirm-button" onClick={onConfirm}>
            <RotateCcw size={15} /> NEUES SPIEL
          </button>
        </div>
      </section>
    </div>
  );
}
