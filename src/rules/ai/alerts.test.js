import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshAlerts } from './alerts.js';

const openMap = {
  transitions: {},
  cells: Object.fromEntries(
    Array.from({ length: 36 }, (_, index) => {
      const x = index % 12;
      const z = Math.floor(index / 12);
      return [`${x},${z},0`, { x, z, level: 0, terrain: 'floor', walkable: true, cover: 0 }];
    })
  ),
};

const unit = (overrides) => ({
  id: 1,
  team: 'player',
  name: 'A',
  x: 0,
  z: 0,
  level: 0,
  ap: 2,
  hp: 5,
  maxHp: 5,
  shield: 0,
  status: null,
  facing: 0,
  power: 0,
  groupId: null,
  ...overrides,
});

const stateWith = (units, alertedGroups = []) => ({
  map: openMap,
  units,
  alertedGroups,
  logs: [],
  eventLog: [],
  phase: 'player',
});

test('an enemy group that becomes visible emits one alert event and is added to alertedGroups', () => {
  const state = stateWith([unit(), unit({ id: 2, team: 'alien', x: 3, z: 0, groupId: 7 })]);
  const { state: next, events } = refreshAlerts(state);
  assert.deepEqual(next.alertedGroups, [7]);
  assert.deepEqual(events, [{ type: 'alert', groupId: 7 }]);
});

test('an already alerted group emits no alert event', () => {
  const state = stateWith([unit(), unit({ id: 2, team: 'alien', x: 3, z: 0, groupId: 7 })], [7]);
  const { state: next, events } = refreshAlerts(state);
  assert.deepEqual(next.alertedGroups, [7]);
  assert.deepEqual(events, []);
});

test('a second refresh after an alert emits nothing', () => {
  const state = stateWith([unit(), unit({ id: 2, team: 'alien', x: 3, z: 0, groupId: 4 })]);
  const first = refreshAlerts(state);
  const second = refreshAlerts(first.state);
  assert.equal(first.events.length, 1);
  assert.deepEqual(second.events, []);
});

test('a hidden or dead enemy group emits no alert event', () => {
  const units = [unit(), unit({ id: 2, team: 'alien', x: 3, z: 0, groupId: 5, hp: 0 })];
  const { state: next, events } = refreshAlerts(stateWith(units));
  assert.deepEqual(next.alertedGroups, []);
  assert.deepEqual(events, []);
});
