import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.js';
import { cellKey } from '../../engine/map.js';
import { exposureAt } from './takeCover.ts';

// Builds an alerted enemy turn where only the chosen enemy and one player are alive.
// The enemy at (c, c) is exposed to a player at (c-3, c). Cell (c+1, c) has cover on its
// west side (the enemy's cell is given cover 2), so moving there removes the exposure.
function setup(role) {
  const state = createInitialState(42);
  const c = Math.floor(state.map.size / 2);
  for (let x = c - 4; x <= c + 2; x += 1) {
    for (let z = c - 2; z <= c + 2; z += 1) {
      const cell = state.map.cells[cellKey({ x, z, level: 0 })];
      if (cell) Object.assign(cell, { terrain: 'floor', walkable: true, cover: 0 });
    }
  }
  state.map.cells[cellKey({ x: c, z: c, level: 0 })].cover = 2;
  const enemy = state.units.find((unit) => unit.team === 'alien');
  const player = state.units.find((unit) => unit.team === 'player');
  const units = state.units.map((unit) => {
    if (unit.id === enemy.id) return { ...unit, aiRole: role, x: c, z: c, level: 0, ap: 2 };
    if (unit.id === player.id) return { ...unit, x: c - 3, z: c, level: 0 };
    return { ...unit, hp: 0 };
  });
  return {
    state: {
      ...state,
      units,
      phase: 'enemy',
      enemyTurnOrder: [enemy.id],
      enemyTurnIndex: 0,
      alertedGroups: [enemy.groupId],
    },
    enemy,
    c,
  };
}

test('an exposed raider moves into a cell that removes its exposure instead of shooting from the open', () => {
  const { state, enemy, c } = setup('raider');
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  assert.ok(exposureAt(state.map, { x: c, z: c, level: 0 }, players) > 0);
  const after = gameReducer(state, { type: 'enemy-step' });
  const moved = after.units.find((unit) => unit.id === enemy.id);
  assert.equal(after.lastShot, null);
  assert.equal(moved.x, c + 1);
  assert.equal(moved.z, c);
  assert.equal(exposureAt(after.map, { x: moved.x, z: moved.z, level: 0 }, players), 0);
});

test('a monster charges instead of taking cover', () => {
  const { state, enemy, c } = setup('monster');
  const after = gameReducer(state, { type: 'enemy-step' });
  const moved = after.units.find((unit) => unit.id === enemy.id);
  assert.notEqual(moved.x, c + 1);
  assert.ok(Math.hypot(moved.x - (c - 3), moved.z - c) < 3 || after.lastShot !== null);
});
