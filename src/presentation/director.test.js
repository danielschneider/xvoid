import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirector, planSteps } from './director.ts';
import { gameReducer } from '../rules/turns/reducer.ts';
import { TIMING } from './timing.ts';

// Fake clock: timers fire in (time, arming order); no real setTimeout is involved.
function fakeScheduler() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => now,
    pending: () => timers.size,
    setTimeout(fn, delay) {
      seq += 1;
      timers.set(seq, { at: now + delay, fn, every: null });
      return seq;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn, delay) {
      seq += 1;
      timers.set(seq, { at: now + delay, fn, every: delay });
      return seq;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    // Fires the next due timer; returns false when none are left.
    next() {
      let best = null;
      for (const [id, timer] of timers) {
        if (!best || timer.at < best.timer.at || (timer.at === best.timer.at && id < best.id)) best = { id, timer };
      }
      if (!best) return false;
      now = best.timer.at;
      if (best.timer.every) best.timer.at += best.timer.every;
      else timers.delete(best.id);
      best.timer.fn();
      return true;
    },
  };
}

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
const cell = (x, z) => ({ x, z, level: 0 });
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

// Runs the director against the real reducer until no timers remain.
// Each dispatch is applied to the state, then the director re-syncs with the new state.
function run(initial, view = { activeEnemyHidden: false, movementHidden: false }) {
  const scheduler = fakeScheduler();
  const log = [];
  let state = initial;
  const director = createDirector({
    scheduler,
    dispatch: (action) => {
      log.push({ at: scheduler.now(), type: action.type });
      state = gameReducer(state, action);
      director.sync(state, view);
    },
  });
  director.sync(state, view);
  let guard = 0;
  while (scheduler.next() && guard < 500) guard += 1;
  assert.ok(guard < 500, 'director did not settle');
  return { log, state, scheduler };
}

test('planSteps: a player shot holds 1000 ms, an enemy shot 1300 ms', () => {
  const player = planSteps(stateWith([], { lastShot: { id: 3, enemyShot: false } }), {
    activeEnemyHidden: false,
    movementHidden: false,
  });
  assert.deepEqual(player[0].timer, {
    kind: 'timeout',
    delay: TIMING.shotHoldMs,
    action: { type: 'finish-shot', id: 3 },
  });
  const enemy = planSteps(stateWith([], { lastShot: { id: 4, enemyShot: true } }), {
    activeEnemyHidden: false,
    movementHidden: false,
  });
  assert.equal(enemy[0].timer.delay, 1300);
});

test('planSteps: enemy phase arms enemy-step at 1400 ms, or 0 ms when the actor is hidden', () => {
  const state = stateWith([], { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0 });
  assert.deepEqual(planSteps(state, { activeEnemyHidden: false, movementHidden: false })[1].timer, {
    kind: 'timeout',
    delay: 1400,
    action: { type: 'enemy-step' },
  });
  assert.equal(planSteps(state, { activeEnemyHidden: true, movementHidden: false })[1].timer.delay, 0);
});

test('planSteps: once every enemy has acted the step is finish-enemy-turn', () => {
  const state = stateWith([], { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 1 });
  assert.deepEqual(planSteps(state, { activeEnemyHidden: true, movementHidden: false })[1].timer, {
    kind: 'timeout',
    delay: 1400,
    action: { type: 'finish-enemy-turn' },
  });
});

test('planSteps: no enemy timer while a movement is running, and no tick when movement is hidden', () => {
  const movement = { id: 5, unitId: 2, path: [cell(1, 0), cell(2, 0)], step: 0 };
  const steps = planSteps(stateWith([], { phase: 'enemy', enemyTurnOrder: [2], movement }), {
    activeEnemyHidden: false,
    movementHidden: true,
  });
  assert.equal(steps[1].timer, null);
  assert.equal(steps[2].timer, null);
  assert.deepEqual(steps[3].timer, { kind: 'timeout', delay: 0, action: { type: 'complete-movement', id: 5 } });
});

test('planSteps: visible movement ticks every 220 ms and completes after path length * 220 + 80 ms', () => {
  const movement = { id: 5, unitId: 1, path: [cell(1, 0), cell(2, 0), cell(3, 0)], step: 0 };
  const steps = planSteps(stateWith([], { movement }), { activeEnemyHidden: false, movementHidden: false });
  assert.deepEqual(steps[2].timer, { kind: 'interval', delay: 220, action: { type: 'advance-movement', id: 5 } });
  assert.equal(steps[3].timer.delay, 3 * 220 + 80);
});

test('director: a visible enemy turn dispatches enemy-step at 1400 ms, then finish-enemy-turn at 2800 ms', () => {
  // One alerted enemy with no AP: it holds, then the phase ends.
  const units = [unit(), unit({ id: 2, team: 'alien', name: 'E', x: 11, z: 0, groupId: 7, ap: 0 })];
  const start = stateWith(units, { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0, alertedGroups: [7] });
  const { log, state } = run(start);
  assert.deepEqual(log, [
    { at: 1400, type: 'enemy-step' },
    { at: 2800, type: 'finish-enemy-turn' },
  ]);
  assert.equal(state.phase, 'player');
  assert.equal(state.turn, 2);
});

test('director: a hidden enemy step runs without delay; the phase end still waits 1400 ms', () => {
  // The hidden 0 ms delay applies only while enemies remain. After the step the phase is
  // finished, so finish-enemy-turn uses the normal 1400 ms (same rule as the former App effect).
  const units = [unit(), unit({ id: 2, team: 'alien', name: 'E', x: 11, z: 0, groupId: 7, ap: 0 })];
  const start = stateWith(units, { phase: 'enemy', enemyTurnOrder: [2], enemyTurnIndex: 0, alertedGroups: [7] });
  const { log } = run(start, { activeEnemyHidden: true, movementHidden: false });
  assert.deepEqual(log, [
    { at: 0, type: 'enemy-step' },
    { at: 1400, type: 'finish-enemy-turn' },
  ]);
});

test('director: a player shot dispatches finish-shot after 1000 ms and keeps the shooter selected until then', () => {
  const units = [unit(), unit({ id: 2, team: 'alien', name: 'E', x: 3, z: 0, hp: 0 })];
  const start = stateWith(units, { lastShot: { id: 9, enemyShot: false, shooterId: 1, targetId: 2 } });
  const { log, state } = run(start);
  assert.deepEqual(log, [{ at: 1000, type: 'finish-shot' }]);
  assert.equal(state.lastShot, null);
});

test('director: a visible 3-step movement ticks every 220 ms and completes 960 ms after the last real advance', () => {
  const units = [unit({ x: 1, z: 0 })];
  const movement = { id: 5, unitId: 1, path: [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0)], step: 0 };
  const { log, state, scheduler } = run(stateWith(units, { movement }));
  assert.equal(state.movement, null);
  // Real advances happen at 220, 440, 660 (step 0 -> 3). Each one replaces the movement object,
  // which re-arms complete-movement for path.length * 220 + 80 = 960 ms: 660 + 960 = 1620.
  // Later ticks (880, 1100, ...) are no-ops for the reducer but still dispatch, as the old interval did.
  assert.deepEqual(
    log.filter((entry) => entry.type === 'complete-movement'),
    [{ at: 1620, type: 'complete-movement' }]
  );
  assert.equal(log.filter((entry) => entry.type === 'advance-movement').at(0).at, 220);
  assert.equal(scheduler.pending(), 0);
});
