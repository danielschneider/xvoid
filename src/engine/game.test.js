import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoverFor, computeCritChance, computeDistanceModifier, computeHitChance, createInitialState, CRIT_CHANCE, CRIT_MULTIPLIER, gameReducer, getFlankedBy } from './game.js';
import { cellKey, getCoverProfile, getReachable, getSideCover, getVisibleCells, hasLineOfSight, isPassable, VISION_RANGE } from './map.js';

function adjacentWalkableCell(map, unit) {
  return Object.values(map.cells).find((cell) => (
    cell.level === unit.level
    && cell.walkable
    && Math.abs(cell.x - unit.x) + Math.abs(cell.z - unit.z) === 1
    && hasLineOfSight(map, unit, cell)
  ));
}

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
    const players = state.units.filter((unit) => unit.team === 'player');
    sizes.add(state.map.size);
    spawnLayouts.add(state.units.map(({ id, x, z }) => `${id}:${x},${z}`).join('|'));
    roleLayouts.add(enemies.map((unit) => unit.aiRole).join('|'));
    assert.deepEqual(new Set(enemies.map((unit) => unit.aiRole)), new Set(['raider', 'stalker', 'scout', 'guard']));
    assert.equal(enemies.length, state.map.size === 32 ? 5 : state.map.size === 40 ? 10 : 20);
    assert.equal(new Set(state.units.map(cellKey)).size, state.units.length);
    assert.ok(state.units.every((unit) => state.map.cells[cellKey(unit)]?.walkable));
    assert.ok(players.every((player) => (
      player.x === 0 || player.z === 0 || player.x === state.map.size - 1 || player.z === state.map.size - 1
    )));
    const visibleCells = getVisibleCells(state.map, players);
    assert.ok([...visibleCells].every((key) => {
      const cell = state.map.cells[key];
      return cell.x >= 0 && cell.z >= 0 && cell.x < state.map.size && cell.z < state.map.size;
    }));

    const reachable = new Set(getReachable(state.map, players[0], new Set(), state.map.size * 2).keys());
    reachable.add(cellKey(players[0]));
    assert.ok(state.units.every((unit) => reachable.has(cellKey(unit))));

    assert.equal(state.map.objectives.length, 3);
    assert.equal(new Set(state.map.objectives.map(cellKey)).size, 3);
    assert.ok(state.map.objectives.every((objective) => state.map.cells[cellKey(objective)]?.walkable));
    for (let objectiveIndex = 1; objectiveIndex < state.map.objectives.length; objectiveIndex += 1) {
      const previous = state.map.objectives[objectiveIndex - 1];
      const objective = state.map.objectives[objectiveIndex];
      assert.ok(Math.hypot(objective.x - previous.x, objective.z - previous.z) >= state.map.size * 0.1);
    }

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

test('movement advances a step counter that stops at the destination', () => {
  const state = createInitialState(42);
  const unit = state.units[0];
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const destination = [...getReachable(state.map, unit, blocked).values()].find((path) => path.apCost === 1)?.path.at(-1);
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
  state.units = state.units.map((unit, index) => unit.id === 'vanguard'
    ? { ...unit, x: 4, z: 5 }
    : { ...unit, x: 28, z: index + 1 });
  const destination = { x: 7, z: 5, level: 0 };
  const moved = gameReducer(state, { type: 'move', destination });
  assert.equal(moved.units[0].x, destination.x);
  assert.ok(moved.movement.path.length > Math.abs(destination.x - state.units[0].x) + 1);
  assert.ok(moved.movement.path.slice(1).every((cell) => isPassable(cell)));
});

test('boxes (pillar/console) are never passable and never reachable', () => {
  for (const seed of [42, 7, 9001, 123456]) {
    const map = createInitialState(seed).map;
    const boxes = Object.values(map.cells).filter((cell) => cell.terrain === 'pillar' || cell.terrain === 'console');
    assert.ok(boxes.length > 0, `seed ${seed} has boxes`);
    assert.ok(boxes.every((box) => !isPassable(box)));
    const reachable = getReachable(map, { x: 0, z: 0, level: 0 }, new Set(), map.size * 4);
    assert.ok(boxes.every((box) => !reachable.has(cellKey(box))), `seed ${seed}: no path enters a box`);
  }
});

test('boxes never disconnect the battlefield', () => {
  for (const seed of [42, 7, 9001, 123456, 555]) {
    const map = createInitialState(seed).map;
    const passable = Object.values(map.cells).filter(isPassable);
    const reachable = getReachable(map, { x: 0, z: 0, level: 0 }, new Set(), map.size * 4);
    const reachableCount = passable.filter((cell) => cell.x === 0 && cell.z === 0 || reachable.has(cellKey(cell))).length;
    assert.equal(reachableCount, passable.length, `seed ${seed}: all passable cells connected`);
  }
});

test('a player cannot move onto a box cell', () => {
  const state = createInitialState(42);
  const box = Object.values(state.map.cells).find((cell) => cell.terrain === 'console' && cell.level === 0);
  assert.ok(box, 'seed 42 has a console box on level 0');
  const units = state.units.map((unit) => unit.id === 'vanguard' ? { ...unit, x: box.x - 1, z: box.z, level: 0 } : unit);
  const rejected = gameReducer({ ...state, units }, { type: 'move', destination: { x: box.x, z: box.z, level: 0 } });
  assert.equal(rejected.movement, null);
  assert.equal(rejected.units.find((unit) => unit.id === 'vanguard').x, box.x - 1);
});

test('selects the next living player with AP when the current player runs out', () => {
  const state = createInitialState(42);
  const exhausted = { ...state, units: state.units.map((unit) => unit.id === 'vanguard' ? { ...unit, ap: 1 } : unit) };
  const next = gameReducer(exhausted, { type: 'ability', name: 'overwatch' });
  assert.equal(next.units[0].ap, 0);
  assert.equal(next.selectedId, 'spectre');
});

test('switching player resets to move mode', () => {
  const state = { ...createInitialState(42), moveMode: false, shootMode: true };
  const selected = gameReducer(state, { type: 'select', id: 'spectre' });
  assert.equal(selected.selectedId, 'spectre');
  assert.equal(selected.moveMode, true);
  assert.equal(selected.shootMode, false);
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
  const enemy = state.units.find((unit) => unit.aiRole === 'raider');
  const target = state.units[0];
  const distanceBefore = Math.hypot(enemy.x - target.x, enemy.z - target.z);
  const enemyTurn = { ...gameReducer(state, { type: 'end-turn' }), enemyTurnOrder: [enemy.id], enemyTurnIndex: 0 };
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

  const nearbyCell = adjacentWalkableCell(state.map, state.units[0]);
  assert.ok(nearbyCell);
  const revealedEnemy = { ...enemy, x: nearbyCell.x, z: nearbyCell.z, level: nearbyCell.level };
  const revealedState = { ...state, units: state.units.map((unit) => unit.id === enemy.id ? revealedEnemy : unit) };
  assert.ok(getVisibleCells(revealedState.map, revealedState.units).has(cellKey(revealedEnemy)));
});

test('a revealed enemy can fire at a player in line of sight', () => {
  const state = createInitialState(42);
  const nearbyCell = adjacentWalkableCell(state.map, state.units[0]);
  assert.ok(nearbyCell);
  const enemy = { ...state.units[3], x: nearbyCell.x, z: nearbyCell.z, level: nearbyCell.level };
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
function withRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function isolateEncounter(state, keep) {
  return { ...state, units: state.units.map((unit) => (keep[unit.id] ? { ...unit, ...keep[unit.id] } : { ...unit, hp: 0 })) };
}

test('overwatch fires at a visible enemy that ends its move in range, without spending the watcher AP', () => {
  const state = createInitialState(42);
  const vanguard = state.units.find((unit) => unit.id === 'vanguard');
  const nearby = adjacentWalkableCell(state.map, vanguard);
  assert.ok(nearby);
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  const placed = isolateEncounter({ ...state, phase: 'enemy' }, {
    vanguard: { status: 'overwatch', ap: 0 },
    [enemy.id]: { x: nearby.x, z: nearby.z, level: nearby.level, ap: 1 },
  });
  const moving = { ...placed, movement: { id: 7, unitId: enemy.id, path: [enemy], step: 0 } };
  const result = withRandom(0, () => gameReducer(moving, { type: 'complete-movement', id: 7 }));
  assert.equal(result.movement, null);
  assert.equal(result.lastShot?.enemyShot, false);
  assert.equal(result.units.find((unit) => unit.id === 'vanguard').status, null);
  assert.equal(result.units.find((unit) => unit.id === 'vanguard').ap, 0);
  assert.match(result.logs[0].text, /^Overwatch: /);
});

test('overwatch does not fire at enemies hidden in fog of war', () => {
  const state = createInitialState(42);
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  const placed = isolateEncounter({ ...state, phase: 'enemy' }, {
    vanguard: { status: 'overwatch' },
    [enemy.id]: { x: 1, z: 1, level: 0 },
  });
  const moving = { ...placed, movement: { id: 8, unitId: enemy.id, path: [enemy], step: 0 } };
  const result = withRandom(0, () => gameReducer(moving, { type: 'complete-movement', id: 8 }));
  assert.equal(result.lastShot, null);
  assert.equal(result.units.find((unit) => unit.id === 'vanguard').status, 'overwatch');
});

test('a single overwatch reaction shot consumes the watcher stance', () => {
  const state = createInitialState(42);
  const vanguard = state.units.find((unit) => unit.id === 'vanguard');
  const nearby = adjacentWalkableCell(state.map, vanguard);
  assert.ok(nearby);
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  const placed = isolateEncounter({ ...state, phase: 'enemy' }, {
    vanguard: { status: 'overwatch' },
    [enemy.id]: { x: nearby.x, z: nearby.z, level: nearby.level },
  });
  const moving = { ...placed, movement: { id: 9, unitId: enemy.id, path: [enemy], step: 0 } };
  const first = withRandom(0, () => gameReducer(moving, { type: 'complete-movement', id: 9 }));
  assert.equal(first.units.find((unit) => unit.id === 'vanguard').status, null);
  const again = { ...first, movement: { id: 10, unitId: enemy.id, path: [enemy], step: 0 } };
  const second = withRandom(0, () => gameReducer(again, { type: 'complete-movement', id: 10 }));
  assert.equal(second.lastShot?.id, first.lastShot?.id);
});

test('shooting at close range gets a distance bonus while long range keeps its penalty', () => {
  assert.ok(Math.abs(computeDistanceModifier(3) - 0.2) < 1e-9);
  assert.equal(computeDistanceModifier(5), 0);
  assert.ok(Math.abs(computeDistanceModifier(8) + 0.3) < 1e-9);

  const state = createInitialState(42);
  state.map.cells[cellKey({ x: 10, z: 10, level: 0 })].cover = 0;
  const target = { x: 10, z: 10, level: 0, status: null, id: 'x' };
  const close = computeHitChance(state, { x: 10, z: 13, level: 0 }, target);
  const neutral = computeHitChance(state, { x: 10, z: 15, level: 0 }, target);
  const far = computeHitChance(state, { x: 10, z: 18, level: 0 }, target);

  assert.ok(close > neutral);
  assert.ok(neutral > far);
});

test('side cover reads the four neighbouring cells on the same level', () => {
  const state = createInitialState(42);
  const cell = { x: 10, z: 10, level: 0 };
  const cells = state.map.cells;
  for (const key of Object.keys(cells)) if (cells[key].x >= 8 && cells[key].x <= 12 && cells[key].z >= 8 && cells[key].z <= 12) cells[key].cover = 0;
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

const setSides = (state, { x, z }, sides) => {
  const offsets = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const [side, [dx, dz]] of Object.entries(offsets)) {
    state.map.cells[cellKey({ x: x + dx, z: z + dz, level: 0 })].cover = sides[side] ?? 0;
  }
};

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
  for (const x of [11, 12]) Object.assign(state.map.cells[cellKey({ x, z: 10, level: 0 })], { terrain: 'floor', walkable: true, cover: 0 });
  const flanker = { x: 13, z: 10, level: 0, team: 'alien', hp: 3, id: 'e' };
  const frontal = { x: 10, z: 7, level: 0, team: 'alien', hp: 3, id: 'f' };
  const withUnits = { ...state, units: [player, flanker, frontal] };
  assert.deepEqual(getFlankedBy(withUnits, player).map((unit) => unit.id), ['e']);
});

test('ending the enemy turn clears all stances', () => {
  const state = createInitialState(42);
  const stanced = { ...state, phase: 'enemy', enemyTurnOrder: [], enemyTurnIndex: 0, units: state.units.map((unit) => ({ ...unit, status: 'overwatch' })) };
  const finished = gameReducer(stanced, { type: 'finish-enemy-turn' });
  assert.ok(finished.units.every((unit) => unit.status === null));
});

test('moving clears stance', () => {
  const state = createInitialState(42);
  const unit = state.units[0];
  const blocked = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const destination = [...getReachable(state.map, unit, blocked).values()].find((path) => path.apCost === 1)?.path.at(-1);
  assert.ok(destination);
  const stanced = { ...state, units: state.units.map((entry) => (entry.id === unit.id ? { ...entry, status: 'overwatch' } : entry)) };
  const moved = gameReducer(stanced, { type: 'move', destination });
  assert.equal(moved.units.find((entry) => entry.id === unit.id).status, null);
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

function withRandomSequence(values, fn) {
  const original = Math.random;
  let index = 0;
  Math.random = () => values[Math.min(index++, values.length - 1)];
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

test('a critical hit doubles base damage and reports crit on the shot', () => {
  const state = createInitialState(42);
  const shooter = state.units.find((unit) => unit.id === 'vanguard');
  const target = { ...state.units.find((unit) => unit.id === 'raider-01'), shield: 0, hp: 9, maxHp: 9 };
  const encounter = {
    ...isolateEncounter(state, { [shooter.id]: { ap: 2 }, [target.id]: target }),
    units: state.units.map((unit) => (unit.id === shooter.id ? { ...unit, x: target.x, z: target.z + 1, level: 0, ap: 2 }
      : unit.id === target.id ? target : { ...unit, hp: 0 })),
  };
  const shooterNow = encounter.units.find((unit) => unit.id === shooter.id);
  const lineOpen = hasLineOfSight(encounter.map, shooterNow, target);
  assert.ok(lineOpen, 'test setup needs an open line of sight');
  // Roll sequence: hit (0), crit (0), damage roll (0 -> base 2) => crit damage 4.
  const result = withRandomSequence([0, 0, 0], () => gameReducer(encounter, { type: 'attack', id: target.id }));
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
    units: state.units.map((unit) => (unit.id === shooter.id ? { ...unit, x: target.x, z: target.z + 1, level: 0, ap: 2 }
      : unit.id === target.id ? target : { ...unit, hp: 0 })),
  };
  const result = withRandomSequence([0, 0.99, 0], () => gameReducer(encounter, { type: 'attack', id: target.id }));
  assert.equal(result.lastShot.crit, false);
  assert.equal(result.lastShot.damage, 2);
});

test('a miss never crits, so the crit roll is not consumed', () => {
  const state = createInitialState(42);
  const shooter = state.units.find((unit) => unit.id === 'vanguard');
  const target = { ...state.units.find((unit) => unit.id === 'raider-01'), shield: 0, hp: 9, maxHp: 9 };
  const encounter = {
    ...state,
    units: state.units.map((unit) => (unit.id === shooter.id ? { ...unit, x: target.x, z: target.z + 1, level: 0, ap: 2 }
      : unit.id === target.id ? target : { ...unit, hp: 0 })),
  };
  const result = withRandomSequence([0.999, 0], () => gameReducer(encounter, { type: 'attack', id: target.id }));
  assert.equal(result.lastShot.hit, false);
  assert.equal(result.lastShot.crit, false);
  assert.equal(result.lastShot.damage, 0);
});

test('enemy shots never crit', () => {
  const state = createInitialState(42);
  const target = state.units.find((unit) => unit.id === 'vanguard');
  const enemy = state.units.find((unit) => unit.id === 'raider-01');
  assert.equal(computeCritChance(state, enemy, target, true), 0);
  assert.equal(computeCritChance(state, target, enemy, false), CRIT_CHANCE);
});
