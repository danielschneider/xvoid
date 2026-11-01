import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../spawn/initialState.ts';
import { cellKey } from '../grid/cells.ts';
import { getVisibleCells, isCellVisible } from './fog.ts';

// isCellVisible must agree with the full-map getVisibleCells, checked on every cell of one map.
test('isCellVisible matches getVisibleCells on a generated map', () => {
  const state = createInitialState(42);
  const visible = getVisibleCells(state.map, state.units);
  for (const cell of Object.values(state.map.cells)) {
    assert.equal(isCellVisible(state.map, state.units, cell), visible.has(cellKey(cell)), cellKey(cell));
  }
});
