import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHitChance, createInitialState } from '../engine/game.js';
import { getCoverAgainst } from '../engine/map.js';
import { selectCombatPreview } from './combatPreview.js';

// Parity: the HUD-facing selector must equal the engine for every shooter/target config.
test('combat preview equals computeHitChance and getCoverAgainst over a config grid', () => {
  let checked = 0;
  for (const seed of [1, 7, 42]) {
    const state = createInitialState(seed);
    for (const targetLevel of [0, 1]) {
      const target = { id: 't', name: 'T', className: 'X', x: 16, z: 16, level: targetLevel, hp: 3 };
      for (let dx = -4; dx <= 4; dx += 1) {
        for (let dz = -4; dz <= 4; dz += 1) {
          for (const shooterLevel of [0, 1, 2]) {
            if (dx === 0 && dz === 0) continue;
            const shooter = { id: 's', name: 'S', className: 'X', x: 16 + dx, z: 16 + dz, level: shooterLevel, hp: 3 };
            const preview = selectCombatPreview(state, shooter, target);
            const cover = getCoverAgainst(state.map, target, shooter);
            assert.equal(preview.hitChance, computeHitChance(state, shooter, target));
            assert.equal(preview.coverTier, cover.cover);
            assert.equal(preview.flanked, cover.flanked);
            assert.equal(preview.hitPercent, preview.visible ? Math.round(preview.hitChance * 100) : 0);
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 0);
});

test('selector returns null without shooter or target', () => {
  const state = createInitialState(1);
  assert.equal(selectCombatPreview(state, null, { x: 1, z: 1, level: 0 }), null);
});
