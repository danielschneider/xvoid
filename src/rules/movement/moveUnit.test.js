import test from 'node:test';
import assert from 'node:assert/strict';
import { moveEnemy, moveUnit } from './moveUnit.js';
import { gameReducer } from '../turns/reducer.js';

// Open 12x3 floor on level 0, no transitions: every cell is walkable.
const openMap = {
  transitions: {},
  cells: Object.fromEntries(Array.from({ length: 36 }, (_, index) => {
    const x = index % 12;
    const z = Math.floor(index / 12);
    return [`${x},${z},0`, { x, z, level: 0, terrain: 'floor', walkable: true, cover: 0 }];
  })),
};

const unit = (overrides) => ({
  id: 1, team: 'player', name: 'A', x: 0, z: 0, level: 0, ap: 2, hp: 5, maxHp: 5, shield: 0,
  status: null, facing: 0, power: 0, groupId: null, ...overrides,
});

function stateWith(units, extra = {}) {
  return {
    map: openMap, units, selectedId: 1, targetId: null, shootMode: false, moveMode: true,
    logs: [], lastShot: null, eventLog: [], rng: 0, nextId: 1, phase: 'player',
    movement: null, alertedGroups: [], enemyTurnOrder: [], enemyTurnIndex: 0, ...extra,
  };
}

test('a player move emits one move event with the path length and enemy false', () => {
  const state = stateWith([unit({ x: 0, z: 0 }), unit({ id: 2, team: 'alien', x: 11, z: 2, ap: 0, groupId: 3 })]);
  const { state: next, events } = moveUnit(state, { x: 3, z: 0, level: 0 });
  assert.equal(next.movement.unitId, 1);
  assert.deepEqual(events, [{ type: 'move', unitId: 1, steps: 3, enemy: false }]);
});

test('a rejected player move returns the same state and no events', () => {
  const state = stateWith([unit({ ap: 0 })]);
  const { state: next, events } = moveUnit(state, { x: 3, z: 0, level: 0 });
  assert.equal(next, state);
  assert.deepEqual(events, []);
});

test('moveEnemy emits a move event flagged as enemy', () => {
  const enemy = unit({ id: 2, team: 'alien', x: 5, z: 1, ap: 2 });
  const state = stateWith([unit(), enemy], { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0 });
  const destination = { path: [{ x: 4, z: 1, level: 0 }], steps: 1 };
  const { events } = moveEnemy(state, enemy, destination, 'E bewegt sich.');
  assert.deepEqual(events, [{ type: 'move', unitId: 2, steps: 1, enemy: true }]);
});

test('gameReducer move appends the move event to eventLog and leaves movement as before', () => {
  const state = stateWith([unit({ x: 0, z: 0 }), unit({ id: 2, team: 'alien', x: 11, z: 2, ap: 0, groupId: 3 })]);
  const after = gameReducer(state, { type: 'move', destination: { x: 2, z: 0, level: 0 } });
  const moves = after.eventLog.filter((event) => event.type === 'move');
  assert.deepEqual(moves, [{ type: 'move', unitId: 1, steps: 2, enemy: false }]);
  assert.equal(after.movement.unitId, 1);
  assert.equal(after.movement.step, 0);
  assert.equal(after.logs[0].text, 'A rückt 2 Felder vor.');
});
