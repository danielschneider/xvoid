import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer } from './reducer.ts';
import { enemyStep } from '../ai/enemyStep.ts';
import { endTurn, finishEnemyTurn, useAbility } from './actions.ts';
import { createInitialState } from '../spawn/initialState.ts';

// 12x3 open floor on level 0 with no transitions: enough for sight, pathing and fog.
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
  postX: 0,
  postZ: 0,
  aiRole: 'raider',
  ...overrides,
});

function stateWith(units, extra = {}) {
  return {
    map: openMap,
    units,
    selectedId: 1,
    targetId: null,
    shootMode: false,
    moveMode: true,
    logs: [],
    lastShot: null,
    eventLog: [],
    rng: 0,
    nextId: 1,
    phase: 'player',
    turn: 1,
    movement: null,
    alertedGroups: [],
    enemyTurnOrder: [],
    enemyTurnIndex: 0,
    ...extra,
  };
}

const ofType = (events, type) => events.filter((event) => event.type === type);

test('endTurn emits turn-start for the turn being ended, after any alerts', () => {
  const units = [unit(), unit({ id: 2, team: 'alien', name: 'E', x: 3, z: 0, groupId: 7, ap: 0 })];
  const { state, events } = endTurn(stateWith(units));
  assert.equal(state.phase, 'enemy');
  assert.deepEqual(ofType(events, 'turn-start'), [{ type: 'turn-start', turn: 1 }]);
  assert.deepEqual(ofType(events, 'alert'), [{ type: 'alert', groupId: 7 }]);
  assert.equal(events.at(-1).type, 'turn-start');
});

test('endTurn outside the player phase emits nothing', () => {
  const state = stateWith([unit()], { phase: 'enemy' });
  assert.deepEqual(endTurn(state), { state, events: [] });
});

test('finishEnemyTurn emits round-start with the new turn and selected unit', () => {
  const units = [unit(), unit({ id: 2, name: 'B', x: 1, z: 0, hp: 0 }), unit({ id: 3, name: 'C', x: 2, z: 0 })];
  const state = stateWith(units, { phase: 'enemy', enemyTurnOrder: [], enemyTurnIndex: 0 });
  const { state: next, events } = finishEnemyTurn(state);
  assert.equal(next.phase, 'player');
  assert.deepEqual(events, [{ type: 'round-start', turn: 2, selectedId: 1 }]);
});

test('finishEnemyTurn while enemies still have turns emits nothing', () => {
  const units = [unit(), unit({ id: 2, team: 'alien', x: 3, z: 0 })];
  const state = stateWith(units, { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0 });
  assert.deepEqual(finishEnemyTurn(state), { state, events: [] });
});

test('useAbility emits overwatch for the unit that spent its AP', () => {
  const state = stateWith([unit({ ap: 2 })]);
  const { state: next, events } = useAbility(state);
  assert.equal(next.units[0].status, 'overwatch');
  assert.deepEqual(events, [{ type: 'overwatch', unitId: 1, name: 'A' }]);
});

test('gameReducer ability appends the overwatch event to eventLog', () => {
  const after = gameReducer(stateWith([unit({ ap: 2 })]), { type: 'ability', name: 'overwatch' });
  assert.deepEqual(ofType(after.eventLog, 'overwatch'), [{ type: 'overwatch', unitId: 1, name: 'A' }]);
});

test('a spent unit cannot use the ability and emits nothing', () => {
  const state = stateWith([unit({ ap: 0 })]);
  assert.deepEqual(useAbility(state), { state, events: [] });
});

test('an alerted enemy that cannot act emits hold, then enemy-turn-end', () => {
  const units = [unit(), unit({ id: 2, team: 'alien', name: 'E', x: 11, z: 0, groupId: 7, ap: 0 })];
  const state = stateWith(units, { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0, alertedGroups: [7] });
  const { state: next, events } = enemyStep(state);
  assert.equal(next.enemyTurnIndex, 1);
  assert.deepEqual(
    events.map((event) => event.type),
    ['hold', 'enemy-turn-end']
  );
  assert.deepEqual(events[0], { type: 'hold', unitId: 2, name: 'E', role: 'raider' });
  assert.deepEqual(events[1], { type: 'enemy-turn-end', enemyId: 2 });
});

test('an enemy that moves emits a move and enemy-turn-end, but no hold', () => {
  const units = [unit(), unit({ id: 2, team: 'alien', name: 'E', x: 11, z: 0, groupId: 7, ap: 2 })];
  const state = stateWith(units, { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0, alertedGroups: [7] });
  const { events } = enemyStep(state);
  assert.deepEqual(ofType(events, 'hold'), []);
  assert.equal(ofType(events, 'move').length, 1);
  assert.equal(ofType(events, 'enemy-turn-end').length, 1);
});

test('an enemy with no living target advances the index and still ends its turn', () => {
  const units = [unit({ hp: 0 }), unit({ id: 2, team: 'alien', name: 'E', x: 11, z: 0, groupId: 7 })];
  const state = stateWith(units, { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0, alertedGroups: [7] });
  const { state: next, events } = enemyStep(state);
  assert.equal(next.enemyTurnIndex, 1);
  assert.deepEqual(events, [{ type: 'enemy-turn-end', enemyId: 2 }]);
});

test('a full enemy phase through the reducer emits turn-start, one enemy-turn-end per enemy, then round-start', () => {
  const base = createInitialState(1);
  let state = gameReducer(base, { type: 'end-turn' });
  assert.deepEqual(ofType(state.eventLog, 'turn-start'), [{ type: 'turn-start', turn: 1 }]);
  let guard = 0;
  while (state.phase === 'enemy' && guard < 200) {
    const finished = state.enemyTurnIndex >= state.enemyTurnOrder.length;
    state = gameReducer(state, { type: finished ? 'finish-enemy-turn' : 'enemy-step' });
    guard += 1;
  }
  assert.equal(state.phase, 'player');
  const rounds = ofType(state.eventLog, 'round-start');
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].turn, 2);
  assert.equal(rounds[0].selectedId, state.selectedId);
});

test('an enemy finishing its move under player overwatch emits a reaction shot event', () => {
  const watcher = unit({ id: 1, status: 'overwatch', ap: 0 });
  const mover = unit({ id: 2, team: 'alien', name: 'E', x: 3, z: 0, groupId: 7, ap: 0 });
  const state = stateWith([watcher, mover], {
    phase: 'enemy',
    alertedGroups: [7],
    enemyTurnOrder: [2],
    enemyTurnIndex: 1,
    movement: { id: 5, unitId: 2, path: [mover], step: 0 },
    nextId: 6,
  });
  const after = gameReducer(state, { type: 'complete-movement', id: 5 });
  assert.equal(after.movement, null);
  const shots = ofType(after.eventLog, 'shot');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].reaction, true);
  assert.equal(shots[0].shooterId, 1);
  assert.equal(shots[0].targetId, 2);
  assert.equal(after.units.find((entry) => entry.id === 1).status, null);
});

test('overwatch spends all remaining AP of the unit', () => {
  const { state: next } = useAbility(stateWith([unit({ ap: 2 })]));
  assert.equal(next.units[0].ap, 0);
  assert.equal(next.units[0].status, 'overwatch');
});

test('overwatch with no other player AP left ends the player round', () => {
  const watcher = unit({ id: 1, ap: 2 });
  const spent = unit({ id: 2, name: 'B', ap: 0 });
  const next = gameReducer(stateWith([watcher, spent]), { type: 'ability', name: 'overwatch' });
  assert.equal(next.phase, 'enemy');
  assert.equal(ofType(next.eventLog, 'turn-start').length, 1);
});

test('overwatch while another player unit has AP hands selection on without ending the round', () => {
  const watcher = unit({ id: 1, ap: 2 });
  const other = unit({ id: 2, name: 'B', ap: 2 });
  const next = gameReducer(stateWith([watcher, other]), { type: 'ability', name: 'overwatch' });
  assert.equal(next.phase, 'player');
  assert.equal(next.selectedId, 2);
});
