import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.ts';
import { getNextReadyUnit } from './readyUnit.ts';

// D6: the reducer's hand-over (finish-shot -> selectNextReadyPlayer) and App's next-unit
// lookup must both come from getNextReadyUnit. Check they agree for several states.
// Roster order (createInitialState seed 1): vanguard, spectre, medic.

function stateWith(ready, selectedId) {
  const base = createInitialState(1);
  return {
    ...base,
    selectedId,
    lastShot: null,
    units: base.units.map((unit) => (unit.team === 'player' ? { ...unit, ap: ready.includes(unit.id) ? 2 : 0 } : unit)),
  };
}

// Reducer path: the selected unit is spent (ap 0) and its shot finishes, then selection moves on.
function reducerHandOver(state) {
  const spent = { ...state, lastShot: { id: 1, enemyShot: false } };
  return gameReducer(spent, { type: 'finish-shot', id: 1 }).selectedId;
}

const cases = [
  { name: 'all ready, vanguard spent', ready: ['spectre', 'medic'], selected: 'vanguard', expected: 'spectre' },
  { name: 'wraps around to first', ready: ['vanguard', 'spectre'], selected: 'medic', expected: 'vanguard' },
  { name: 'skips spent middle', ready: ['vanguard', 'medic'], selected: 'spectre', expected: 'medic' },
  { name: 'only the last unit ready', ready: ['medic'], selected: 'vanguard', expected: 'medic' },
  { name: 'current is the only ready one', ready: ['vanguard'], selected: 'vanguard', expected: null },
  { name: 'no ready units', ready: [], selected: 'vanguard', expected: null },
];

for (const { name, ready, selected, expected } of cases) {
  test(`getNextReadyUnit and reducer agree: ${name}`, () => {
    const state = stateWith(ready, selected);
    const next = getNextReadyUnit(state);
    assert.equal(next?.id ?? null, expected);
    // Reducer must select the same unit; when none is ready it keeps the current selection.
    if (selected !== expected) {
      assert.equal(reducerHandOver(state), expected ?? selected);
    }
  });
}
