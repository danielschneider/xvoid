import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_TYPES,
  appendEvents,
  shotEvent,
  blockedEvent,
  moveEvent,
  deathEvent,
  alertEvent,
  enemyTurnEndEvent,
} from './events.js';

test('event constructors produce plain objects with a type tag', () => {
  assert.deepEqual(
    shotEvent({
      shooterId: 1,
      shooterName: 'A',
      targetId: 2,
      targetName: 'B',
      hit: true,
      crit: false,
      damage: 3,
      enemyShot: false,
    }),
    {
      type: 'shot',
      shooterId: 1,
      shooterName: 'A',
      targetId: 2,
      targetName: 'B',
      hit: true,
      crit: false,
      damage: 3,
      enemyShot: false,
      reaction: false,
    }
  );
  assert.deepEqual(blockedEvent({ shooterId: 1, targetId: 2, reason: 'range' }), {
    type: 'blocked',
    shooterId: 1,
    targetId: 2,
    reason: 'range',
  });
  assert.deepEqual(moveEvent({ unitId: 4, name: 'C', steps: 2 }), {
    type: 'move',
    unitId: 4,
    name: 'C',
    steps: 2,
    enemy: false,
    role: null,
    intent: 'walk',
  });
  assert.deepEqual(deathEvent({ unitId: 5 }), { type: 'death', unitId: 5 });
  assert.deepEqual(alertEvent({ groupId: 0 }), { type: 'alert', groupId: 0 });
  assert.deepEqual(enemyTurnEndEvent({ enemyId: 7 }), { type: 'enemy-turn-end', enemyId: 7 });
  assert.equal(EVENT_TYPES.enemyTurnEnd, 'enemy-turn-end');
});

test('appendEvents returns the same array when there is nothing to add', () => {
  const log = [{ type: 'alert', groupId: 0 }];
  assert.equal(appendEvents(log, [], 5), log);
});

test('appendEvents keeps only the newest entries', () => {
  const events = [1, 2, 3, 4, 5].map((n) => ({ type: 'move', unitId: n }));
  const kept = appendEvents([], events, 3);
  assert.deepEqual(
    kept.map((event) => event.unitId),
    [3, 4, 5]
  );
  const more = appendEvents(kept, [{ type: 'death', unitId: 6 }], 3);
  assert.deepEqual(
    more.map((event) => event.unitId),
    [4, 5, 6]
  );
});
