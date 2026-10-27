import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoverFor, computeHitChance, createInitialState, getFlankedBy } from '../../engine/game.js';
import { cellKey, getCoverProfile, getSideCover } from '../../engine/map.js';
import { setSides } from '../../../test/fixtures.js';

test('side cover reads the four neighbouring cells on the same level', () => {
  const state = createInitialState(42);
  const cell = { x: 10, z: 10, level: 0 };
  const cells = state.map.cells;
  for (const key of Object.keys(cells))
    if (cells[key].x >= 8 && cells[key].x <= 12 && cells[key].z >= 8 && cells[key].z <= 12) cells[key].cover = 0;
  cells[cellKey({ x: 10, z: 9, level: 0 })].cover = 2;
  cells[cellKey({ x: 11, z: 10, level: 0 })].cover = 1;
  assert.deepEqual(getSideCover(state.map, cell), { N: 2, E: 1, S: 0, W: 0 });
});

test('cover profile of a destination reports the strongest side and labels it', () => {
  const state = createInitialState(42);
  const cell = { x: 10, z: 10, level: 0 };
  setSides(state, cell, { N: 2, E: 1 });
  const profile = getCoverProfile(state.map, cell);
  assert.equal(profile.tier, 2);
  assert.equal(profile.label, 'full');
  assert.deepEqual(profile.sides, { N: 2, E: 1, S: 0, W: 0 });
  setSides(state, cell, { E: 1 });
  assert.equal(getCoverProfile(state.map, cell).label, 'half');
  setSides(state, cell, {});
  assert.equal(getCoverProfile(state.map, cell).label, 'open');
});

test('a shot from a covered side meets that side cover', () => {
  const state = createInitialState(42);
  const target = { x: 10, z: 10, level: 0 };
  state.map.cells[cellKey({ x: 10, z: 9, level: 0 })].cover = 2;
  state.map.cells[cellKey({ x: 9, z: 10, level: 0 })].cover = 0;
  state.map.cells[cellKey({ x: 11, z: 10, level: 0 })].cover = 0;
  state.map.cells[cellKey({ x: 10, z: 11, level: 0 })].cover = 0;
  assert.equal(computeCoverFor(state, { x: 10, z: 7, level: 0 }, target).cover, 2);
});

test('a shot from an open side next to cover is a flank and gets no cover', () => {
  const state = createInitialState(42);
  const target = { x: 10, z: 10, level: 0 };
  setSides(state, target, { N: 2 });
  assert.deepEqual(computeCoverFor(state, { x: 13, z: 10, level: 0 }, target), { cover: 0, flanked: true });
  const covered = computeHitChance(state, { x: 10, z: 7, level: 0 }, target, false);
  const flankShot = computeHitChance(state, { x: 13, z: 10, level: 0 }, target, false);
  assert.ok(flankShot > covered);
});

test('an open target is never flanked', () => {
  const state = createInitialState(42);
  const target = { x: 10, z: 10, level: 0 };
  setSides(state, target, {});
  assert.deepEqual(computeCoverFor(state, { x: 13, z: 10, level: 0 }, target), { cover: 0, flanked: false });
});

test('a diagonal attacker gets the weaker of its two sides', () => {
  const state = createInitialState(42);
  const target = { x: 10, z: 10, level: 0 };
  setSides(state, target, { N: 2, E: 1 });
  // Attacker at NE: sides N (full) and E (half) -> weaker side applies.
  assert.equal(computeCoverFor(state, { x: 13, z: 7, level: 0 }, target).cover, 1);
});

test('getFlankedBy reports enemies that flank a covered player', () => {
  const state = createInitialState(42);
  const player = { x: 10, z: 10, level: 0, team: 'player', hp: 5, id: 'p' };
  setSides(state, player, { N: 2 });
  for (const x of [11, 12])
    Object.assign(state.map.cells[cellKey({ x, z: 10, level: 0 })], { terrain: 'floor', walkable: true, cover: 0 });
  const flanker = { x: 13, z: 10, level: 0, team: 'alien', hp: 3, id: 'e' };
  const frontal = { x: 10, z: 7, level: 0, team: 'alien', hp: 3, id: 'f' };
  const withUnits = { ...state, units: [player, flanker, frontal] };
  assert.deepEqual(
    getFlankedBy(withUnits, player).map((unit) => unit.id),
    ['e']
  );
});

test('getFlankedBy lists every enemy flanking from different open sides', () => {
  const state = createInitialState(42);
  const player = { x: 10, z: 10, level: 0, team: 'player', hp: 5, id: 'p' };
  setSides(state, player, { N: 2 });
  for (const x of [7, 8, 9, 11, 12])
    Object.assign(state.map.cells[cellKey({ x, z: 10, level: 0 })], { terrain: 'floor', walkable: true, cover: 0 });
  const east = { x: 13, z: 10, level: 0, team: 'alien', hp: 3, id: 'e' };
  const west = { x: 7, z: 10, level: 0, team: 'alien', hp: 3, id: 'w' };
  const frontal = { x: 10, z: 7, level: 0, team: 'alien', hp: 3, id: 'f' };
  const withUnits = { ...state, units: [player, east, west, frontal] };
  assert.deepEqual(
    getFlankedBy(withUnits, player)
      .map((unit) => unit.id)
      .sort(),
    ['e', 'w']
  );
});

test('getFlankedBy reports player units flanking an enemy target', () => {
  const state = createInitialState(42);
  const enemy = { x: 10, z: 10, level: 0, team: 'alien', hp: 3, id: 'a' };
  setSides(state, enemy, { N: 2 });
  for (const x of [11, 12])
    Object.assign(state.map.cells[cellKey({ x, z: 10, level: 0 })], { terrain: 'floor', walkable: true, cover: 0 });
  const flanker = { x: 13, z: 10, level: 0, team: 'player', hp: 5, id: 'p' };
  const withUnits = { ...state, units: [enemy, flanker] };
  assert.deepEqual(
    getFlankedBy(withUnits, enemy).map((unit) => unit.id),
    ['p']
  );
});
