import type { GameState, Unit } from '../types.ts';
import { getVisibleCells } from './fog.ts';

// Units whose sight counts for fog: the squad at its current position. A moving player unit
// is handled by the view (it sees from its live cell), so the stored positions are used here.
export function markExplored(state: GameState, units: Unit[] = state.units): GameState {
  const visible = getVisibleCells(state.map, units);
  const known = new Set(state.explored ?? []);
  let changed = false;
  for (const key of visible) {
    if (!known.has(key)) {
      known.add(key);
      changed = true;
    }
  }
  return changed ? { ...state, explored: [...known] } : state;
}
