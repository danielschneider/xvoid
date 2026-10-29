import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.js';
import { isBehind, rearDistance } from './rearApproach.ts';
import { ROLES } from './roles.ts';

// A player facing +z (angle 0): rear is toward -z.
const target = { x: 10, z: 10, facing: 0 };

test('isBehind is true only for cells in the rear half-plane of the target', () => {
  assert.equal(isBehind(target, { x: 10, z: 8 }), true);
  assert.equal(isBehind(target, { x: 10, z: 12 }), false);
  assert.equal(isBehind(target, { x: 7, z: 10 }), false);
  assert.equal(isBehind(target, { x: 10, z: 10 }), false);
});

test('rearDistance is zero behind the target and grows with distance from the rear arc', () => {
  assert.equal(rearDistance(target, { x: 10, z: 8 }), 0);
  assert.ok(rearDistance(target, { x: 10, z: 14 }) > rearDistance(target, { x: 10, z: 11 }));
});

test('sneaker role is registered with the flank movement preference', () => {
  assert.equal(ROLES.sneaker.movePreference, 'flank');
  assert.equal(ROLES.sneaker.retreat, null);
});

test('a sneaker never moves closer from the front while no player is revealed', () => {
  const seeded = createInitialState(42);
  const sneaker = seeded.units.find((unit) => unit.team === 'alien');
  const player = seeded.units.find((unit) => unit.team === 'player');
  const units = seeded.units.map((unit) => {
    if (unit.id === sneaker.id)
      return { ...unit, aiRole: 'sneaker', x: player.x + 3, z: player.z, level: player.level, ap: 2 };
    if (unit.team === 'player') return { ...unit, facing: 0, x: player.x, z: player.z, level: player.level };
    return unit;
  });
  const turn = {
    ...seeded,
    units,
    phase: 'enemy',
    alertedGroups: [sneaker.groupId],
    enemyTurnOrder: [sneaker.id],
    enemyTurnIndex: 0,
  };
  const after = gameReducer(turn, { type: 'enemy-step' });
  const moved = after.units.find((unit) => unit.id === sneaker.id);
  if (moved.x !== sneaker.x || moved.z !== sneaker.z) {
    assert.ok(rearDistance(player, moved) <= rearDistance(player, { x: player.x + 3, z: player.z }));
  }
});
