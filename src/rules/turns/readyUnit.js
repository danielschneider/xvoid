// The one definition of "next ready unit". Pure: depends only on the passed state.
// Walks living player units in roster order, starting after the selected unit and
// wrapping around. The selected unit itself is never returned. Returns the first unit
// with AP left, or null when the phase is not 'player' or no other unit is ready.
export function getNextReadyUnit(state) {
  if (state.phase !== 'player') return null;
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const count = players.length;
  const currentIndex = players.findIndex((unit) => unit.id === state.selectedId);
  for (let step = 1; step <= count; step += 1) {
    const unit = players[(currentIndex + step + count) % count];
    if (unit.id !== state.selectedId && unit.ap > 0) return unit;
  }
  return null;
}
