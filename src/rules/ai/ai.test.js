import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.ts';
import { cellKey, getReachable, getVisibleCells } from '../../engine/map.ts';

// Test helper: pins the first alien to `role` so role-dependent assertions do not depend on the spawn shuffle.
function withFirstEnemyRole(state, role) {
  const firstAlien = state.units.find((unit) => unit.team === 'alien').id;
  return {
    ...state,
    units: state.units.map((unit) => (unit.id === firstAlien ? { ...unit, aiRole: role } : unit)),
  };
}

test('enemies advance toward the nearest player during their turn', () => {
  const state = withFirstEnemyRole(createInitialState(42), 'raider');
  const enemy = state.units.find((unit) => unit.team === 'alien' && unit.aiRole === 'raider');
  const target = state.units[0];
  const distanceBefore = Math.hypot(enemy.x - target.x, enemy.z - target.z);
  const enemyTurn = {
    ...gameReducer(state, { type: 'end-turn' }),
    enemyTurnOrder: [enemy.id],
    enemyTurnIndex: 0,
    alertedGroups: [enemy.groupId],
  };
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const movedEnemy = afterAction.units.find((unit) => unit.id === enemy.id);
  const distanceAfter = Math.hypot(movedEnemy.x - target.x, movedEnemy.z - target.z);
  assert.equal(afterAction.lastShot, null);
  assert.ok(distanceAfter < distanceBefore);
});

test('unalerted enemies never approach or shoot, and stay near their post', () => {
  const state = createInitialState(42);
  const enemies = state.units.filter((unit) => unit.team === 'alien');
  for (let round = 0; round < 20; round += 1) {
    let turn = {
      ...state,
      phase: 'enemy',
      alertedGroups: [],
      enemyTurnOrder: enemies.map((unit) => unit.id),
      enemyTurnIndex: 0,
    };
    while (turn.enemyTurnIndex < turn.enemyTurnOrder.length) {
      turn = gameReducer(turn, { type: 'enemy-step' });
      if (turn.movement) turn = gameReducer(turn, { type: 'complete-movement', id: turn.movement.id });
    }
    assert.equal(turn.lastShot, null);
    for (const enemy of turn.units.filter((unit) => unit.team === 'alien')) {
      assert.ok(Math.hypot(enemy.x - enemy.postX, enemy.z - enemy.postZ) <= 3 + 1e-9);
    }
  }
});

test('enemies in one spawn cluster share a group, and a sighting alerts the whole group', () => {
  const state = createInitialState(42);
  const enemies = state.units.filter((unit) => unit.team === 'alien');
  for (const a of enemies) {
    for (const b of enemies) {
      if (Math.hypot(a.x - b.x, a.z - b.z) <= 2) assert.equal(a.groupId, b.groupId);
    }
  }
  const spotted = enemies[0];
  const groupMembers = enemies.filter((unit) => unit.groupId === spotted.groupId);
  const player = state.units.find((unit) => unit.team === 'player');
  const seen = {
    ...state,
    units: state.units.map((unit) =>
      unit.id === spotted.id ? { ...unit, x: player.x, z: player.z, level: player.level } : unit
    ),
  };
  const refreshed = gameReducer(seen, { type: 'end-turn' });
  assert.ok(refreshed.alertedGroups.includes(spotted.groupId));
  assert.ok(groupMembers.every((unit) => refreshed.alertedGroups.includes(unit.groupId)));
});

test('guards hold their assigned post when no player is visible', () => {
  const seeded = createInitialState(42);
  // Pin the first alien to guard: spawn roles are shuffled per seed, so the seed alone is not enough.
  const state = withFirstEnemyRole(seeded, 'guard');
  const guard = state.units.find((unit) => unit.aiRole === 'guard');
  const corners = [
    { x: 1, z: 1 },
    { x: state.map.size - 2, z: state.map.size - 2 },
  ];
  // Corners may be walls on some layouts; the guard test only needs a far-away player position.
  const corner = corners.sort(
    (a, b) => Math.hypot(b.x - guard.x, b.z - guard.z) - Math.hypot(a.x - guard.x, a.z - guard.z)
  )[0];
  const units = state.units.map((unit) => {
    if (unit.team === 'player') return { ...unit, ...corner };
    if (unit.id === guard.id) return { ...unit, x: guard.postX, z: guard.postZ };
    return { ...unit, hp: 0 };
  });
  const enemyTurn = {
    ...state,
    units,
    phase: 'enemy',
    enemyTurnOrder: [guard.id],
    enemyTurnIndex: 0,
    alertedGroups: [guard.groupId],
  };
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

test('raiders under fire take cover before shooting, so no shot is fired from an exposed cell', () => {
  const state = withFirstEnemyRole(createInitialState(42), 'raider');
  const raider = state.units.find((unit) => unit.team === 'alien' && unit.aiRole === 'raider');
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
  assert.equal(afterAction.lastShot, null);
  const moved = afterAction.units.find((unit) => unit.id === raider.id);
  assert.ok(moved.x !== center || moved.z !== center);
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
  const visibleForwardPathExists = [...reachable.entries()].some(
    ([key]) => visible.has(key) && Math.hypot(state.map.cells[key].x - center, state.map.cells[key].z - center) < 6
  );
  assert.ok(visibleForwardPathExists);

  const enemyTurn = {
    ...state,
    units,
    phase: 'enemy',
    enemyTurnOrder: [stalker.id],
    enemyTurnIndex: 0,
    alertedGroups: [stalker.groupId],
  };
  const afterAction = gameReducer(enemyTurn, { type: 'enemy-step' });
  const destination = afterAction.movement.path.at(-1);
  assert.ok(Math.hypot(destination.x - center, destination.z - center) < 6);
  assert.ok(!visible.has(cellKey(destination)));
});
