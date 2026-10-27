import test from 'node:test';
import assert from 'node:assert/strict';
import { fireAt, resolveOverwatch } from './resolveShot.js';
import { gameReducer } from '../turns/reducer.js';

// Open 12x3 floor on level 0: line of sight is clear and cover is zero everywhere.
// Fog (used by overwatch) needs real cells, so the grid is explicit.
const openMap = {
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

const shooter = () => unit({ id: 1, team: 'player', x: 0, z: 0 });
const enemy = (overrides = {}) => unit({ id: 2, team: 'alien', name: 'E', x: 3, z: 0, ap: 0, ...overrides });

// First rng cursor (deterministic search) whose first draw is a hit for this shot.
function cursorForHit(units) {
  for (let cursor = 0; cursor < 10000; cursor += 1) {
    const { state } = fireAt(stateWith(units, { rng: cursor }), 2, 1);
    if (state.lastShot?.hit) return cursor;
  }
  throw new Error('no hitting cursor found');
}

test('a resolved shot emits one shot event matching lastShot', () => {
  const units = [shooter(), enemy()];
  const { state, events } = fireAt(stateWith(units), 2, 1);
  assert.ok(state.lastShot, 'shot should resolve');
  assert.equal(events[0].type, 'shot');
  assert.deepEqual(events[0], {
    type: 'shot',
    shooterId: 1,
    shooterName: 'A',
    targetId: 2,
    targetName: 'E',
    hit: state.lastShot.hit,
    crit: state.lastShot.crit,
    damage: state.lastShot.damage,
    enemyShot: false,
    reaction: false,
  });
});

test('a hit that reduces the target to 0 hp also emits a death event', () => {
  const units = [shooter(), enemy({ hp: 1 })];
  const { state, events } = fireAt(stateWith(units, { rng: cursorForHit(units) }), 2, 1);
  assert.equal(state.units[1].hp, 0);
  assert.deepEqual(events.map((event) => event.type), ['shot', 'death']);
  assert.deepEqual(events[1], { type: 'death', unitId: 2 });
});

test('a hit that leaves the target alive emits no death event', () => {
  const units = [shooter(), enemy({ hp: 50 })];
  const { state, events } = fireAt(stateWith(units, { rng: cursorForHit(units) }), 2, 1);
  assert.ok(state.lastShot.hit);
  assert.ok(state.units[1].hp > 0);
  assert.deepEqual(events.map((event) => event.type), ['shot']);
});

test('a blocked line of sight returns no events and no shot', () => {
  const wall = { cells: { ...openMap.cells, '1,0,0': { x: 1, z: 0, level: 0, terrain: 'wall', walkable: false, cover: 2 } } };
  const units = [shooter(), enemy()];
  const base = { ...stateWith(units), map: wall };
  const { state, events } = fireAt(base, 2, 1);
  assert.deepEqual(events, [{ type: 'blocked', shooterId: 1, targetId: 2, reason: 'sight' }]);
  assert.equal(state.lastShot, null);
});

test('an out-of-range target returns no events and no shot', () => {
  const units = [shooter(), enemy({ x: 40 })];
  const { state, events } = fireAt(stateWith(units), 2, 1);
  assert.deepEqual(events, [{ type: 'blocked', shooterId: 1, targetId: 2, reason: 'range' }]);
  assert.equal(state.lastShot, null);
});

test('an action without AP returns no events and no shot', () => {
  const units = [shooter(), enemy()];
  units[0] = { ...units[0], ap: 0 };
  const { state, events } = fireAt(stateWith(units), 2, 1);
  assert.deepEqual(events, []);
  assert.equal(state.lastShot, null);
});

test('overwatch without a watcher returns no events', () => {
  const units = [shooter(), enemy()];
  const { state, events } = resolveOverwatch(stateWith(units), 2);
  assert.deepEqual(events, []);
  assert.equal(state.lastShot, null);
});

test('overwatch shot is a reaction and clears the watcher status', () => {
  const watcher = shooter();
  const units = [{ ...watcher, status: 'overwatch', ap: 0 }, enemy()];
  const { state, events } = resolveOverwatch(stateWith(units), 2);
  assert.ok(state.lastShot, 'overwatch should fire');
  assert.equal(events[0].type, 'shot');
  assert.equal(events[0].reaction, true);
  assert.equal(events[0].shooterId, 1);
  assert.equal(state.units[0].status, null);
});

test('gameReducer appends shot events to eventLog and keeps lastShot unchanged', () => {
  const units = [shooter(), enemy()];
  const before = stateWith(units);
  const after = gameReducer(before, { type: 'attack', id: 2 });
  const shotEvents = after.eventLog.filter((event) => event.type === 'shot');
  assert.equal(shotEvents.length, 1);
  assert.equal(shotEvents[0].targetId, 2);
  assert.equal(after.lastShot.to.id, 2);
});
