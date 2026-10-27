import { Check, Copy } from 'lucide-react';
import { COPY } from '../copy.js';

export function MapLegend() {
  return (
    <div className="map-legend" aria-label={COPY.map.legendLabel}>
      <span>
        <i style={{ background: '#4aa8ff' }} />
        {COPY.map.legendFull}
      </span>
      <span>
        <i style={{ background: '#7fe08a' }} />
        {COPY.map.legendHalf}
      </span>
      <span>
        <i style={{ background: '#8c9a94' }} />
        {COPY.map.legendOpen}
      </span>
    </div>
  );
}

export function MapCoordinates({ state, seedCopied, onCopySeed }) {
  return (
    <div className="map-coordinates">
      <span>
        {state.map.size}
        {COPY.map.times}
        {state.map.size}
      </span>
      <i />
      {COPY.map.procGen}{' '}
      <span className="seed-group">
        <i />
        <span>
          {COPY.map.seedPrefix}
          {state.map.seed}
        </span>
        <button
          className="seed-copy-button"
          onClick={onCopySeed}
          aria-label={COPY.map.copySeedLabel}
          title={seedCopied ? COPY.map.seedCopied : COPY.map.copySeed}
        >
          {seedCopied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </span>
    </div>
  );
}
