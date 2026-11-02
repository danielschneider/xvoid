import { useEffect, useState } from 'react';
import { toWorld, toWorldY } from '../coords.js';
import { addStains, stainsForShot } from './blood.js';

// Accumulates ground blood stains from hits in state.lastShot. Stains are keyed by generation, so a
// new game starts empty. Each shot adds its stains once (deduplicated by shot id). Bounded by STAIN_MAX.
export function useBloodStains(lastShot, generation) {
  const [log, setLog] = useState({ generation, stains: [] });

  useEffect(() => {
    if (!lastShot?.hit) return;
    const cell = toWorld(lastShot.to);
    const floorY = toWorldY(lastShot.to);
    setLog((current) => {
      const base = current.generation === generation ? current : { generation, stains: [] };
      if (base.stains.some((stain) => stain.key.startsWith(`${lastShot.id}:`))) return base;
      return { generation, stains: addStains(base.stains, stainsForShot(lastShot, cell.x, cell.z, floorY)) };
    });
  }, [lastShot, generation]);

  return log.generation === generation ? log.stains : [];
}
