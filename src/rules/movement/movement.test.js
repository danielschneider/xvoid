import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.ts';
import { cellKey, getReachable, isPassable } from '../../engine/map.ts';
import { movementLimits } from '../../engine/game.ts';

test('movement follows reachable cells and spends one AP nearby', () => {
  const state = createInitialState(42);
  const unit = state.units[0];
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const destination = [...getReachable(state.map, unit, blocked).values()]
    .find((path) => path.apCost === 1)
    ?.path.at(-1);
  assert.ok(destination);
  const moved = gameReducer(state, { type: 'move', destination });
  const movedUnit = moved.units.find((entry) => entry.id === unit.id);
  const route = moved.movement.path;
  const previous = route.at(-2);
  const last = route.at(-1);
  assert.deepEqual([movedUnit.x, movedUnit.z, movedUnit.ap], [destination.x, destination.z, 1]);
  assert.equal(movedUnit.facing, Math.atan2(last.x - previous.x, last.z - previous.z));
});

test('movement advances a step counter that stops at the destination', () => {
  const state = createInitialState(42);
  const unit = state.units[0];
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const destination = [...getReachable(state.map, unit, blocked).values()]
    .find((path) => path.apCost === 1)
    ?.path.at(-1);
  assert.ok(destination);
  let moved = gameReducer(state, { type: 'move', destination });
  assert.equal(moved.movement.step, 0);
  const id = moved.movement.id;
  for (let i = 0; i < moved.movement.path.length + 3; i += 1) {
    moved = gameReducer(moved, { type: 'advance-movement', id });
  }
  assert.equal(moved.movement.step, moved.movement.path.length - 1);
  assert.equal(gameReducer(moved, { type: 'advance-movement', id: -1 }), moved);
});

test('movement route follows walkable cells around walls', () => {
  const state = createInitialState(42);
  state.units = state.units.map((unit, index) =>
    unit.id === 'vanguard' ? { ...unit, x: 4, z: 5 } : { ...unit, x: 28, z: index + 1 }
  );
  const destination = { x: 7, z: 2, level: 0 };
  const moved = gameReducer(state, { type: 'move', destination });
  assert.equal(moved.units[0].x, destination.x);
  assert.ok(moved.movement.path.length > Math.abs(destination.x - state.units[0].x) + 1);
  assert.ok(moved.movement.path.slice(1).every((cell) => isPassable(cell)));
});

test('a player cannot move onto a box cell', () => {
  const state = createInitialState(42);
  const box = Object.values(state.map.cells).find((cell) => cell.terrain === 'console' && cell.level === 0);
  assert.ok(box, 'seed 42 has a console box on level 0');
  const units = state.units.map((unit) =>
    unit.id === 'vanguard' ? { ...unit, x: box.x - 1, z: box.z, level: 0 } : unit
  );
  const rejected = gameReducer({ ...state, units }, { type: 'move', destination: { x: box.x, z: box.z, level: 0 } });
  assert.equal(rejected.movement, null);
  assert.equal(rejected.units.find((unit) => unit.id === 'vanguard').x, box.x - 1);
});

test('each AP moves moveRange steps: 1 AP reaches moveRange, 2 AP reaches double', () => {
  const state = createInitialState(42);
  for (const unit of state.units.filter((entry) => entry.team === 'player')) {
    const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
    const one = [...getReachable(state.map, unit, blocked, unit.moveRange, unit.moveRange).values()];
    const two = [...getReachable(state.map, unit, blocked, unit.moveRange * 2, unit.moveRange).values()];
    assert.ok(one.every((entry) => entry.steps <= unit.moveRange));
    assert.ok(two.every((entry) => entry.steps <= unit.moveRange * 2));
    assert.ok(two.some((entry) => entry.steps > unit.moveRange));
    assert.ok(one.every((entry) => entry.apCost === 1));
    assert.ok(two.every((entry) => entry.apCost === Math.ceil(entry.steps / unit.moveRange)));
  }
});

test('a unit with 1 AP can only move moveRange steps', () => {
  const state = createInitialState(42);
  const unit = state.units.find((entry) => entry.id === 'spectre');
  const encounter = {
    ...state,
    units: state.units.map((entry) => (entry.id === unit.id ? { ...entry, ap: 1 } : entry)),
  };
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const { maxSteps, stepsPerAp } = movementLimits(encounter.units.find((entry) => entry.id === unit.id));
  const reachable = [...getReachable(encounter.map, unit, blocked, maxSteps, stepsPerAp).values()];
  const far = reachable.find((entry) => entry.steps > unit.moveRange);
  assert.equal(far, undefined);
  assert.ok(encounter.units.find((entry) => entry.id === unit.id).ap === 1);
});
