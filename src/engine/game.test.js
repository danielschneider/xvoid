import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from './game.js';
import { cellKey, getReachable, getVisibleCells, hasLineOfSight } from './map.js';

test('creates a seeded 32x32 battlefield with traversable upper levels', () => {
  const state = createInitialState(42);
  assert.equal(state.map.size, 32);
  assert.equal(state.map.seed, 42);
  assert.ok(state.map.cells[cellKey({ x: 6, z: 5, level: 1 })]);
  const paths = getReachable(state.map, { x: 6, z: 5, level: 0 });
  assert.ok(paths.has(cellKey({ x: 6, z: 5, level: 1 })));
});

test('new seeds vary map size, squad size, and spawn positions deterministically', () => {
  const sizes = new Set();
  const spawnLayouts = new Set();
  const roleLayouts = new Set();
  for (let index = 1; index <= 60; index += 1) {
    const seed = 100_000 + index * 7_919;
    const state = createInitialState(seed);
    const enemies = state.units.filter((unit) => unit.team === 'alien');
    sizes.add(state.map.size);
    spawnLayouts.add(state.units.map(({ id, x, z }) => `${id}:${x},${z}`).join('|'));
    roleLayouts.add(enemies.map((unit) => unit.aiRole).join('|'));
    assert.deepEqual(new Set(enemies.map((unit) => unit.aiRole)), new Set(['raider', 'stalker', 'scout', 'guard']));
    assert.equal(enemies.length, state.map.size === 32 ? 5 : state.map.size === 40 ? 10 : 20);
    assert.equal(new Set(state.units.map(cellKey)).size, state.units.length);
    assert.ok(state.units.every((unit) => state.map.cells[cellKey(unit)]?.walkable));
  }
  assert.deepEqual([...sizes].sort((a, b) => a - b), [32, 40, 48]);
  assert.ok(spawnLayouts.size > 1);
  assert.ok(roleLayouts.size > 1);

  const first = createInitialState(42);
  const second = createInitialState(42);
  assert.deepEqual(first.units.map(({ id, x, z, aiRole }) => [id, x, z, aiRole]), second.units.map(({ id, x, z, aiRole }) => [id, x, z, aiRole]));
});

test('movement follows reachable cells and spends one AP nearby', () => {
  const state = createInitialState(42);
  const unit = state.units[0];
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const destination = [...getReachable(state.map, unit, blocked).values()].find((path) => path.apCost === 1)?.path.at(-1);
  assert.ok(destination);
  const moved = gameReducer(state, { type: 'move', destination });
  const movedUnit = moved.units.find((entry) => entry.id === unit.id);
  const route = moved.movement.path;
  const previous = route.at(-2);
  const last = route.at(-1);
  assert.deepEqual([movedUnit.x, movedUnit.z, movedUnit.ap], [destination.x, destination.z, 1]);
  assert.equal(movedUnit.facing, Math.atan2(last.x - previous.x, last.z - previous.z));
});

test('movement route follows walkable cells around walls', () => {
  const state = createInitialState(42);
  state.units = state.units.map((unit, index) => unit.id === 'vanguard'
    ? { ...unit, x: 4, z: 5 }
    : { ...unit, x: 28, z: index + 1 });
  const destination = { x: 7, z: 5, level: 0 };
  const moved = gameReducer(state, { type: 'move', destination });
  assert.equal(moved.units[0].x, destination.x);
  assert.ok(moved.movement.path.length > Math.abs(destination.x - state.units[0].x) + 1);
  assert.ok(moved.movement.path.slice(1).every((cell) => cell.walkable));
});

test('selects the next living player with AP when the current player runs out', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.id === 'vanguard' ? { ...unit, ap: 1 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.units[0].ap, 0);
  assert.equal(next.selectedId, 'spectre');
});

test('keeps the current player selected when no player has AP left', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.team === 'player' ? { ...unit, ap: 0 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.selectedId, 'vanguard');
});

test('walls block line of sight without consuming an attack point', () => {
  const state = createInitialState(42);
  const shooter = state.units[0];
  const target = { ...state.units[3], x: 6, z: 5 };
  const encounter = { ...state, units: state.units.map((unit) => unit.id === target.id ? target : unit) };
  assert.equal(hasLineOfSight(encounter.map, shooter, target), false);
  const result = gameReducer(encounter, { type: 'attack', id: target.id });
  assert.equal(result.units[0].ap, shooter.ap);
  assert.equal(result.lastShot, null);
  assert.match(result.logs[0].text, /blockiert/);
});

test('ending the player turn refreshes AP and advances the round', () => {
  const state = createInitialState(42);
  const spent = gameReducer(state, { type: 'ability', name: 'overwatch' });
  const enemyTurn = gameReducer(spent, { type: 'end-turn' });
  assert.equal(enemyTurn.phase, 'enemy');
  assert.equal(enemyTurn.turn, 1);
  const enemyAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  assert.equal(enemyAction.enemyTurnIndex, 1);
  const finished = gameReducer({ ...enemyAction, enemyTurnIndex: enemyAction.enemyTurnOrder.length }, { type: 'finish-enemy-turn' });
  assert.equal(finished.turn, 2);
  assert.equal(finished.phase, 'player');
  assert.equal(finished.units[0].ap, 2);
});

test('enemies advance toward the nearest player during their turn', () => {
  const state = createInitialState(42);
  const enemy = state.units[3];
  const target = state.units[0];
  const distanceBefore = Math.hypot(enemy.x - target.x, enemy.z - target.z);
  const enemyTurn = gameReducer(state, { type: 'end-turn' });
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const movedEnemy = afterAction.units.find((unit) => unit.id === enemy.id);
  const distanceAfter = Math.hypot(movedEnemy.x - target.x, movedEnemy.z - target.z);
  assert.equal(afterAction.lastShot, null);
  assert.ok(distanceAfter < distanceBefore);
});

test('guards hold their assigned post when no player is visible', () => {
  const state = createInitialState(42);
  const guard = state.units.find((unit) => unit.aiRole === 'guard');
  const corners = [{ x: 1, z: 1 }, { x: state.map.size - 2, z: state.map.size - 2 }];
  const corner = corners.sort((a, b) => (
    Math.hypot(b.x - guard.x, b.z - guard.z) - Math.hypot(a.x - guard.x, a.z - guard.z)
  ))[0];
  const units = state.units.map((unit) => {
    if (unit.team === 'player') return { ...unit, ...corner };
    if (unit.id === guard.id) return { ...unit, x: guard.postX, z: guard.postZ };
    return { ...unit, hp: 0 };
  });
  const enemyTurn = { ...state, units, phase: 'enemy', enemyTurnOrder: [guard.id], enemyTurnIndex: 0 };
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const heldGuard = afterAction.units.find((unit) => unit.id === guard.id);
  assert.equal(heldGuard.x, guard.postX);
  assert.equal(heldGuard.z, guard.postZ);
  assert.equal(afterAction.enemyTurnIndex, 1);
});

test('scouts retreat along a route when critically hurt and nearby', () => {
  const state = createInitialState(42);
  const scout = state.units.find((unit) => unit.aiRole === 'scout');
  const center = Math.floor(state.map.size / 2);
  const units = state.units.map((unit) => {
    if (unit.team === 'player') {
      const offsets = { vanguard: [-1, 0], spectre: [0, -1], medic: [-1, -1] }[unit.id];
      return { ...unit, x: center + offsets[0], z: center + offsets[1] };
    }
    if (unit.id === scout.id) return { ...unit, x: center + 2, z: center, hp: 2 };
    return { ...unit, hp: 0 };
  });
  const enemyTurn = { ...state, units, phase: 'enemy', enemyTurnOrder: [scout.id], enemyTurnIndex: 0 };
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const retreatedScout = afterAction.units.find((unit) => unit.id === scout.id);
  assert.ok(Math.hypot(retreatedScout.x - center, retreatedScout.z - center) > 2);
  assert.equal(afterAction.lastShot, null);
});

test('raiders prioritize exposed players over equally close covered players', () => {
  const state = createInitialState(42);
  const raider = state.units.find((unit) => unit.aiRole === 'raider');
  const vanguard = state.units.find((unit) => unit.id === 'vanguard');
  const spectre = state.units.find((unit) => unit.id === 'spectre');
  const center = Math.floor(state.map.size / 2);
  const exposed = { ...vanguard, x: center - 1, z: center };
  const covered = { ...spectre, x: center, z: center - 1 };
  state.map.cells[cellKey(exposed)].cover = 0;
  state.map.cells[cellKey(covered)].cover = 2;
  const units = state.units.map((unit) => {
    if (unit.id === exposed.id) return exposed;
    if (unit.id === covered.id) return covered;
    if (unit.id === raider.id) return { ...unit, x: center, z: center, ap: 2 };
    if (unit.team === 'player') return { ...unit, hp: 0 };
    return { ...unit, hp: 0 };
  });
  const enemyTurn = { ...state, units, phase: 'enemy', enemyTurnOrder: [raider.id], enemyTurnIndex: 0 };
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  assert.equal(afterAction.lastShot?.to.id, exposed.id);
});

test('stalkers choose a concealed forward route when one is available', () => {
  const state = createInitialState(42);
  const stalker = state.units.find((unit) => unit.aiRole === 'stalker');
  const center = Math.floor(state.map.size / 2);
  const barrier = state.map.cells[cellKey({ x: center + 3, z: center })];
  barrier.terrain = 'wall';
  barrier.walkable = false;
  const units = state.units.map((unit) => {
    if (unit.team === 'player') return { ...unit, x: center, z: center };
    if (unit.id === stalker.id) return { ...unit, x: center + 6, z: center, ap: 2 };
    return { ...unit, hp: 0 };
  });
  const movedStalker = units.find((unit) => unit.id === stalker.id);
  const blocked = new Set(units.filter((unit) => unit.id !== stalker.id && unit.hp > 0).map(cellKey));
  const reachable = getReachable(state.map, movedStalker, blocked, 6);
  const players = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visible = getVisibleCells(state.map, players);
  const visibleForwardPathExists = [...reachable.entries()].some(([key]) => (
    visible.has(key) && Math.hypot(state.map.cells[key].x - center, state.map.cells[key].z - center) < 6
  ));
  assert.ok(visibleForwardPathExists);

  const enemyTurn = { ...state, units, phase: 'enemy', enemyTurnOrder: [stalker.id], enemyTurnIndex: 0 };
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const destination = afterAction.movement.path.at(-1);
  assert.ok(Math.hypot(destination.x - center, destination.z - center) < 6);
  assert.ok(!visible.has(cellKey(destination)));
});

test('player vision reveals nearby enemies but leaves distant enemies in fog', () => {
  const state = createInitialState(42);
  const enemy = state.units[3];
  const visible = getVisibleCells(state.map, state.units);
  assert.ok(visible.has(cellKey(state.units[0])));
  assert.ok(!visible.has(cellKey(enemy)));

  const revealedEnemy = { ...enemy, x: 3, z: 6 };
  const revealedState = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? revealedEnemy : unit) };
  assert.ok(getVisibleCells(revealedState.map, revealedState.units).has(cellKey(revealedEnemy)));
});

test('a revealed enemy can fire at a player in line of sight', () => {
  const state = createInitialState(42);
  const enemy = { ...state.units[3], x: 3, z: 6 };
  const encounter = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? enemy : unit) };
  const enemyTurn = gameReducer(encounter, { type: 'end-turn' });
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  assert.equal(afterAction.lastShot?.enemyShot, true);
});

test('selected player turns toward the targeted enemy', () => {
  const state = createInitialState(42);
  const player = state.units[0];
  const enemy = { ...state.units[3], x: player.x, z: player.z + 1 };
  const encounter = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? enemy : unit) };
  const aimed = gameReducer(encounter, { type: 'target', id: enemy.id });
  assert.equal(aimed.units[0].facing, 0);
});