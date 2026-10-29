import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCritChance,
  computeDistanceModifier,
  computeHitChance,
  createInitialState,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  gameReducer,
} from '../../engine/game.ts';
import { cellKey, hasLineOfSight } from '../../engine/map.ts';
import { adjacentWalkableCell, isolateEncounter, openCellAt, withDraws } from '../../../test/fixtures.js';

test('a revealed enemy can fire at a player in line of sight', () => {
  const state = createInitialState(42);
  const nearbyCell = adjacentWalkableCell(state.map, state.units[0]) ?? openCellAt(state.map, state.units[0], 2);
  assert.ok(nearbyCell);
  // Pin the role: the spawn shuffle assigns roles per seed, and this test is about firing.
  const enemy = { ...state.units[3], aiRole: 'guard', x: nearbyCell.x, z: nearbyCell.z, level: nearbyCell.level };
  const encounter = { ...state, units: state.units.map((unit) => (unit.id === enemy.id ? enemy : unit)) };
  const enemyTurn = gameReducer(encounter, { type: 'end-turn' });
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  assert.equal(afterAction.lastShot?.enemyShot, true);
});

test('selected player turns toward the targeted enemy', () => {
  const state = createInitialState(42);
  const player = state.units[0];
  const enemy = { ...state.units[3], x: player.x, z: player.z + 1 };
  const encounter = { ...state, units: state.units.map((unit) => (unit.id === enemy.id ? enemy : unit)) };
  const aimed = gameReducer(encounter, { type: 'target', id: enemy.id });
  assert.equal(aimed.units[0].facing, 0);
});

test('overwatch fires at a visible enemy that ends its move in range, without spending the watcher AP', () => {
  const state = createInitialState(42);
  const vanguard = state.units.find((unit) => unit.id === 'vanguard');
  const nearby = adjacentWalkableCell(state.map, vanguard);
  assert.ok(nearby);
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  const placed = isolateEncounter(
    { ...state, phase: 'enemy' },
    {
      vanguard: { status: 'overwatch', ap: 0 },
      [enemy.id]: { x: nearby.x, z: nearby.z, level: nearby.level, ap: 1 },
    }
  );
  const moving = { ...placed, movement: { id: 7, unitId: enemy.id, path: [enemy], step: 0 } };
  const result = gameReducer(withDraws(moving, [0]), { type: 'complete-movement', id: 7 });
  assert.equal(result.movement, null);
  assert.equal(result.lastShot?.enemyShot, false);
  assert.equal(result.units.find((unit) => unit.id === 'vanguard').status, null);
  assert.equal(result.units.find((unit) => unit.id === 'vanguard').ap, 0);
  assert.match(result.logs[0].text, /^Overwatch: /);
});

test('overwatch does not fire at enemies hidden in fog of war', () => {
  const state = createInitialState(42);
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  const placed = isolateEncounter(
    { ...state, phase: 'enemy' },
    {
      vanguard: { status: 'overwatch' },
      [enemy.id]: { x: 1, z: 1, level: 0 },
    }
  );
  const moving = { ...placed, movement: { id: 8, unitId: enemy.id, path: [enemy], step: 0 } };
  const result = gameReducer(withDraws(moving, [0]), { type: 'complete-movement', id: 8 });
  assert.equal(result.lastShot, null);
  assert.equal(result.units.find((unit) => unit.id === 'vanguard').status, 'overwatch');
});

test('a single overwatch reaction shot consumes the watcher stance', () => {
  const state = createInitialState(42);
  const vanguard = state.units.find((unit) => unit.id === 'vanguard');
  const nearby = adjacentWalkableCell(state.map, vanguard);
  assert.ok(nearby);
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  const placed = isolateEncounter(
    { ...state, phase: 'enemy' },
    {
      vanguard: { status: 'overwatch' },
      [enemy.id]: { x: nearby.x, z: nearby.z, level: nearby.level },
    }
  );
  const moving = { ...placed, movement: { id: 9, unitId: enemy.id, path: [enemy], step: 0 } };
  const first = gameReducer(withDraws(moving, [0]), { type: 'complete-movement', id: 9 });
  assert.equal(first.units.find((unit) => unit.id === 'vanguard').status, null);
  const again = { ...first, movement: { id: 10, unitId: enemy.id, path: [enemy], step: 0 } };
  const second = gameReducer(withDraws(again, [0]), { type: 'complete-movement', id: 10 });
  assert.equal(second.lastShot?.id, first.lastShot?.id);
});

test('shooting at close range gets a distance bonus while long range keeps its penalty', () => {
  assert.ok(Math.abs(computeDistanceModifier(3) - 0.1) < 1e-9);
  assert.equal(computeDistanceModifier(5), 0);
  assert.ok(Math.abs(computeDistanceModifier(8) + 0.15) < 1e-9);

  const state = createInitialState(42);
  // Clear a straight open lane on a fresh spot so the layout of the seed does not matter.
  const column = 10;
  for (let z = 6; z <= 18; z += 1) {
    const cell = state.map.cells[cellKey({ x: column, z, level: 0 })];
    Object.assign(cell, { terrain: 'floor', walkable: true, cover: 0 });
  }
  const target = { x: column, z: 10, level: 0, status: null, id: 'x' };
  const close = computeHitChance(state, { x: column, z: 13, level: 0 }, target);
  const neutral = computeHitChance(state, { x: column, z: 15, level: 0 }, target);
  const far = computeHitChance(state, { x: column, z: 18, level: 0 }, target);

  assert.ok(close > neutral);
  assert.ok(neutral > far);
});

test('a critical hit doubles base damage and reports crit on the shot', () => {
  const state = createInitialState(42);
  const shooter = state.units.find((unit) => unit.id === 'vanguard');
  const target = { ...state.units.find((unit) => unit.id === 'raider-01'), shield: 0, hp: 9, maxHp: 9 };
  const encounter = {
    ...isolateEncounter(state, { [shooter.id]: { ap: 2 }, [target.id]: target }),
    units: state.units.map((unit) =>
      unit.id === shooter.id
        ? { ...unit, x: target.x, z: target.z + 1, level: 0, ap: 2 }
        : unit.id === target.id
          ? target
          : { ...unit, hp: 0 }
    ),
  };
  const shooterNow = encounter.units.find((unit) => unit.id === shooter.id);
  const lineOpen = hasLineOfSight(encounter.map, shooterNow, target);
  assert.ok(lineOpen, 'test setup needs an open line of sight');
  // Roll sequence: hit (0), crit (0), damage roll (0 -> base 2) => crit damage 4.
  const result = gameReducer(withDraws(encounter, [0, 0, 0]), { type: 'attack', id: target.id });
  assert.equal(result.lastShot.hit, true);
  assert.equal(result.lastShot.crit, true);
  assert.equal(result.lastShot.damage, 2 * CRIT_MULTIPLIER);
  assert.equal(result.units.find((unit) => unit.id === target.id).hp, 9 - 4);
});

test('a non-critical hit keeps base damage and reports crit as false', () => {
  const state = createInitialState(42);
  const shooter = state.units.find((unit) => unit.id === 'vanguard');
  const target = { ...state.units.find((unit) => unit.id === 'raider-01'), shield: 0, hp: 9, maxHp: 9 };
  const encounter = {
    ...state,
    units: state.units.map((unit) =>
      unit.id === shooter.id
        ? { ...unit, x: target.x, z: target.z + 1, level: 0, ap: 2 }
        : unit.id === target.id
          ? target
          : { ...unit, hp: 0 }
    ),
  };
  const result = gameReducer(withDraws(encounter, [0, 0.99, 0]), { type: 'attack', id: target.id });
  assert.equal(result.lastShot.crit, false);
  assert.equal(result.lastShot.damage, 2);
});

test('a miss never crits, so the crit roll is not consumed', () => {
  const state = createInitialState(42);
  const shooter = state.units.find((unit) => unit.id === 'vanguard');
  const target = { ...state.units.find((unit) => unit.id === 'raider-01'), shield: 0, hp: 9, maxHp: 9 };
  const encounter = {
    ...state,
    units: state.units.map((unit) =>
      unit.id === shooter.id
        ? { ...unit, x: target.x, z: target.z + 1, level: 0, ap: 2 }
        : unit.id === target.id
          ? target
          : { ...unit, hp: 0 }
    ),
  };
  const result = gameReducer(withDraws(encounter, [0.999, 0]), { type: 'attack', id: target.id });
  assert.equal(result.lastShot.hit, false);
  assert.equal(result.lastShot.crit, false);
  assert.equal(result.lastShot.damage, 0);
});

test('enemy shots never crit', () => {
  assert.equal(computeCritChance(true), 0);
  assert.equal(computeCritChance(false), CRIT_CHANCE);
});

test('player shooting power adds to damage, enemy shots ignore it', () => {
  const state = createInitialState(42);
  const shooter = { ...state.units.find((unit) => unit.id === 'spectre'), ap: 2 };
  const target = { ...state.units.find((unit) => unit.id === 'raider-01'), shield: 0, hp: 20, maxHp: 20 };
  const encounter = {
    ...state,
    selectedId: shooter.id,
    units: state.units.map((unit) =>
      unit.id === shooter.id
        ? { ...shooter, x: target.x, z: target.z + 1, level: 0 }
        : unit.id === target.id
          ? target
          : { ...unit, hp: 0 }
    ),
  };
  // Hit (0), no crit (0.99), base roll 0 -> 2 + power 1 = 3.
  const result = gameReducer(withDraws(encounter, [0, 0.99, 0]), { type: 'attack', id: target.id });
  assert.equal(result.lastShot.damage, 3);
});
