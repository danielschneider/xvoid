import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBattlefield } from './map.js';
import { createInitialState } from './game.js';

// Golden hashes guard map generation and starting units for seeds 1..60.
// They must not change unless a rule change is intended. Regenerate only with
// GOLDEN_REGENERATE=1 npm test, and record the reason in the commit message.
const FIXTURE = fileURLToPath(new URL('../../test/fixtures/golden-hashes.json', import.meta.url));

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
};
const hash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

function computeGolden() {
  const out = {};
  for (let seed = 1; seed <= 60; seed += 1) {
    out[seed] = {
      map: hash(createBattlefield(seed)),
      units: hash(createInitialState(seed).units),
    };
  }
  return out;
}

test('golden: map and starting units for seeds 1..60 match the fixture', () => {
  const current = computeGolden();
  if (process.env.GOLDEN_REGENERATE === '1') {
    writeFileSync(FIXTURE, `${JSON.stringify(current, null, 2)}\n`);
    return;
  }
  const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  for (const seed of Object.keys(expected)) {
    assert.deepEqual(current[seed], expected[seed], `golden mismatch for seed ${seed}`);
  }
});
