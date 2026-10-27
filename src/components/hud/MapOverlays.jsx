import { Check, Copy } from 'lucide-react';

export function MapLegend() {
  return (
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
  );
}

export function MapCoordinates({ state, seedCopied, onCopySeed }) {
  return (
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
  );
}
