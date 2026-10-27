import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from './index.js';

// Smoke test: every symbol the UI and selectors import from rules/ is exported by the public index.
const PUBLIC_API = [
  'SHOT_RANGE',
  'cellKey',
  'cellHeight',
  'createInitialState',
  'gameReducer',
  'getNextReadyUnit',
  'getReachable',
  'movementLimits',
  'computeHitChance',
  'computePlayerHitParts',
  'getFlankedBy',
  'getCoverAgainst',
  'getCoverProfile',
  'getSideCover',
  'hasLineOfSight',
  'getVisibleCells',
];

test('rules/index.js exposes the UI-facing API', () => {
  for (const name of PUBLIC_API) {
    assert.notEqual(rules[name], undefined, `missing export ${name}`);
  }
  assert.equal(rules.SHOT_RANGE, 10);
  assert.equal(Object.keys(rules).length, PUBLIC_API.length);
});
