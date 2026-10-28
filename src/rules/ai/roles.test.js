import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, gameReducer } from '../../engine/game.js';
import { ROLES, getRole } from './roles.js';
import { ENEMY_MOVE_STEPS } from '../constants.js';

test('every role table entry defines the parameters enemyStep reads', () => {
  assert.deepEqual(Object.keys(ROLES).sort(), [
    'crawler',
    'guard',
    'monster',
    'raider',
    'scout',
    'sneaker',
    'soldier',
    'stalker',
  ]);
  for (const [name, role] of Object.entries(ROLES)) {
    assert.equal(role.maxSteps, ENEMY_MOVE_STEPS[name], `${name} maxSteps`);
    assert.ok(['nearest', 'exposed'].includes(role.targetChoice), `${name} targetChoice`);
    assert.ok(['approach', 'post', 'conceal', 'flank'].includes(role.movePreference), `${name} movePreference`);
    assert.equal('holdMessage' in role, false, `${name} has no log wording in the role table`);
  }
});

test('getRole throws for a missing role instead of falling back to raider', () => {
  assert.throws(() => getRole({ id: 'x', aiRole: undefined }), /missing or unknown role/);
  assert.throws(() => getRole({ id: 'x' }), /missing or unknown role/);
});

test('getRole throws for an unknown role name', () => {
  assert.throws(() => getRole({ id: 'x', aiRole: 'berserker' }), /unknown role: berserker/);
});

test('enemy turn throws when the acting enemy has no role', () => {
  const state = createInitialState(42);
  const enemy = state.units.find((unit) => unit.team === 'alien');
  const units = state.units.map((unit) => (unit.id === enemy.id ? { ...unit, aiRole: undefined } : unit));
  const enemyTurn = {
    ...state,
    units,
    phase: 'enemy',
    enemyTurnOrder: [enemy.id],
    enemyTurnIndex: 0,
    alertedGroups: [enemy.groupId],
  };
  assert.throws(() => gameReducer(enemyTurn, { type: 'enemy-step' }), /missing or unknown role/);
});

test('enemy turn throws when the acting enemy has an unknown role', () => {
  const state = createInitialState(42);
  const enemy = state.units.find((unit) => unit.team === 'alien');
  const units = state.units.map((unit) => (unit.id === enemy.id ? { ...unit, aiRole: 'berserker' } : unit));
  const enemyTurn = {
    ...state,
    units,
    phase: 'enemy',
    enemyTurnOrder: [enemy.id],
    enemyTurnIndex: 0,
    alertedGroups: [enemy.groupId],
  };
  assert.throws(() => gameReducer(enemyTurn, { type: 'enemy-step' }), /unknown role: berserker/);
});
