import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.js';
import { cellKey, getReachable, getVisibleCells } from '../../engine/map.js';

test('new seeds vary map size, squad size, and spawn positions deterministically', () => {
  const sizes = new Set();
  const spawnLayouts = new Set();
  const roleLayouts = new Set();
  for (let index = 1; index <= 60; index += 1) {
    const seed = 100_000 + index * 7_919;
    const state = createInitialState(seed);
    const enemies = state.units.filter((unit) => unit.team === 'alien');
    const players = state.units.filter((unit) => unit.team === 'player');
    sizes.add(state.map.size);
    spawnLayouts.add(state.units.map(({ id, x, z }) => `${id}:${x},${z}`).join('|'));
    roleLayouts.add(enemies.map((unit) => unit.aiRole).join('|'));
    assert.deepEqual(new Set(enemies.map((unit) => unit.aiRole)), new Set(['raider', 'stalker', 'scout', 'guard']));
    assert.equal(enemies.length, state.map.size === 32 ? 5 : state.map.size === 40 ? 10 : 20);
    assert.equal(new Set(state.units.map(cellKey)).size, state.units.length);
    assert.ok(state.units.every((unit) => state.map.cells[cellKey(unit)]?.walkable));
    assert.ok(
      players.every(
        (player) =>
          player.x === 0 || player.z === 0 || player.x === state.map.size - 1 || player.z === state.map.size - 1
      )
    );
    const visibleCells = getVisibleCells(state.map, players);
    assert.ok(
      [...visibleCells].every((key) => {
        const cell = state.map.cells[key];
        return cell.x >= 0 && cell.z >= 0 && cell.x < state.map.size && cell.z < state.map.size;
      })
    );

    const reachable = new Set(getReachable(state.map, players[0], new Set(), state.map.size * 2).keys());
    reachable.add(cellKey(players[0]));
    assert.ok(state.units.every((unit) => reachable.has(cellKey(unit))));

    const middle = state.map.size / 2;
    const quadrants = [
      (cell) => cell.x < middle && cell.z < middle,
      (cell) => cell.x >= middle && cell.z < middle,
      (cell) => cell.x < middle && cell.z >= middle,
      (cell) => cell.x >= middle && cell.z >= middle,
    ];
    for (const inQuadrant of quadrants) {
      assert.ok(Object.values(state.map.cells).some((cell) => inQuadrant(cell) && cell.cover > 0));
      assert.ok(Object.values(state.map.cells).some((cell) => inQuadrant(cell) && cell.level > 0));
    }
  }
  assert.deepEqual(
    [...sizes].sort((a, b) => a - b),
    [32, 40, 48]
  );
  assert.ok(spawnLayouts.size > 1);
  assert.ok(roleLayouts.size > 1);

  const first = createInitialState(42);
  const second = createInitialState(42);
  assert.deepEqual(
    first.units.map(({ id, x, z, aiRole }) => [id, x, z, aiRole]),
    second.units.map(({ id, x, z, aiRole }) => [id, x, z, aiRole])
  );
});

test('regenerate increments the generation so views remount units on level reset', () => {
  const state = createInitialState(42);
  assert.equal(state.generation, 0);
  const next = gameReducer(state, { type: 'regenerate', seed: 777 });
  assert.equal(next.generation, 1);
  const again = gameReducer(next, { type: 'regenerate', seed: 778 });
  assert.equal(again.generation, 2);
});

test('initial selection is a player unit that can move, even when the squad boxes in the vanguard', () => {
  const state = createInitialState(516104, 1);
  const selected = state.units.find((unit) => unit.id === state.selectedId);
  const blocked = new Set(state.units.filter((unit) => unit.id !== selected.id && unit.hp > 0).map(cellKey));
  assert.equal(selected.team, 'player');
  assert.ok(getReachable(state.map, selected, blocked, 10).size > 0);
});

test('the three player types differ in HP, movement range and shooting power', () => {
  const players = createInitialState(42).units.filter((unit) => unit.team === 'player');
  const byId = Object.fromEntries(players.map((unit) => [unit.id, unit]));
  assert.equal(new Set(players.map((unit) => unit.moveRange)).size, 3);
  assert.equal(new Set(players.map((unit) => unit.power)).size, 3);
  assert.equal(new Set(players.map((unit) => unit.maxHp)).size, 3);
  assert.ok(byId.spectre.moveRange > byId.medic.moveRange && byId.medic.moveRange > byId.vanguard.moveRange);
  assert.ok(byId.spectre.power > byId.vanguard.power && byId.vanguard.power > byId.medic.power);
  assert.ok(byId.spectre.maxHp < byId.vanguard.maxHp && byId.spectre.maxHp < byId.medic.maxHp);
});
