import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cachedBattlefield } from '../../test/battlefieldCache.js';
import { createStartingUnits } from '../rules/spawn/placement.ts';
import { makeRandom } from '../rules/rng.ts';

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
    // Same derivation as createInitialState, reusing the cached map (verified equal for seeds 1..60).
    const map = cachedBattlefield(seed);
    out[seed] = {
      map: hash(map),
      units: hash(createStartingUnits(map, makeRandom(seed ^ 0x9e3779b9))),
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
