import test from 'node:test';
import assert from 'node:assert/strict';
import { appendLogs, logLine, INTRO_LOG, LOG_LIMIT } from './logText.js';
import {
  shotEvent,
  blockedEvent,
  moveEvent,
  deathEvent,
  alertEvent,
  enemyTurnEndEvent,
  turnStartEvent,
  roundStartEvent,
  overwatchEvent,
  holdEvent,
} from './events.js';

const shot = (overrides) =>
  shotEvent({
    shooterId: 1,
    shooterName: 'Ada',
    targetId: 2,
    targetName: 'Gurk',
    hit: true,
    crit: false,
    damage: 3,
    enemyShot: false,
    ...overrides,
  });

test('shot hit reads "trifft ... für N Schaden" with kind hit', () => {
  assert.deepEqual(logLine(shot()), { text: 'Ada trifft Gurk für 3 Schaden.', kind: 'hit' });
});

test('shot crit reads the KRITISCHEN template with kind hit', () => {
  assert.deepEqual(logLine(shot({ crit: true, damage: 6 })), {
    text: 'Ada landet einen KRITISCHEN Treffer auf Gurk für 6 Schaden.',
    kind: 'hit',
  });
});

test('shot miss reads "verfehlt" with kind combat', () => {
  assert.deepEqual(logLine(shot({ hit: false, damage: 0 })), { text: 'Ada verfehlt Gurk.', kind: 'combat' });
});

test('reaction shots carry the "Overwatch: " prefix for hit, crit and miss', () => {
  assert.equal(logLine(shot({ reaction: true })).text, 'Overwatch: Ada trifft Gurk für 3 Schaden.');
  assert.equal(
    logLine(shot({ reaction: true, crit: true, damage: 6 })).text,
    'Overwatch: Ada landet einen KRITISCHEN Treffer auf Gurk für 6 Schaden.'
  );
  assert.equal(logLine(shot({ reaction: true, hit: false, damage: 0 })).text, 'Overwatch: Ada verfehlt Gurk.');
});

test('blocked shot reads the sight and range templates with kind combat', () => {
  assert.deepEqual(logLine(blockedEvent({ shooterId: 1, targetId: 2, reason: 'sight' })), {
    text: 'Schusslinie blockiert.',
    kind: 'combat',
  });
  assert.deepEqual(logLine(blockedEvent({ shooterId: 1, targetId: 2, reason: 'range' })), {
    text: 'Ziel außer Reichweite.',
    kind: 'combat',
  });
});

test('player move reads "rückt N Felder vor" with kind move', () => {
  assert.deepEqual(logLine(moveEvent({ unitId: 1, name: 'Ada', steps: 4 })), {
    text: 'Ada rückt 4 Felder vor.',
    kind: 'move',
  });
});

test('enemy patrol, advance and retreat read the role wording', () => {
  assert.equal(
    logLine(moveEvent({ unitId: 2, name: 'Gurk', steps: 1, enemy: true, role: 'stalker', intent: 'patrol' })).text,
    'Gurk patrouilliert.'
  );
  assert.equal(
    logLine(moveEvent({ unitId: 2, name: 'Gurk', steps: 1, enemy: true, role: 'raider', intent: 'advance' })).text,
    'Gurk rückt vor.'
  );
  assert.equal(
    logLine(moveEvent({ unitId: 2, name: 'Gurk', steps: 1, enemy: true, role: 'guard', intent: 'advance' })).text,
    'Gurk kehrt zum Posten zurück.'
  );
  assert.equal(
    logLine(moveEvent({ unitId: 2, name: 'Gurk', steps: 1, enemy: true, role: 'scout', intent: 'retreat' })).text,
    'Gurk zieht sich zurück.'
  );
});

test('hold reads the role hold wording with kind combat', () => {
  assert.deepEqual(logLine(holdEvent({ unitId: 2, name: 'Gurk', role: 'raider' })), {
    text: 'Gurk hält die Position.',
    kind: 'combat',
  });
  assert.deepEqual(logLine(holdEvent({ unitId: 2, name: 'Gurk', role: 'stalker' })), {
    text: 'Gurk bleibt verborgen.',
    kind: 'combat',
  });
  assert.deepEqual(logLine(holdEvent({ unitId: 2, name: 'Gurk', role: 'guard' })), {
    text: 'Gurk hält den Posten.',
    kind: 'combat',
  });
});

test('overwatch reads "NAME: Overwatch." with kind system', () => {
  assert.deepEqual(logLine(overwatchEvent({ unitId: 1, name: 'Ada' })), { text: 'Ada: Overwatch.', kind: 'system' });
});

test('turn start reads "Feindzug beginnt." and round start reads the round number', () => {
  assert.deepEqual(logLine(turnStartEvent({ turn: 1 })), { text: 'Feindzug beginnt.', kind: 'combat' });
  assert.deepEqual(logLine(roundStartEvent({ turn: 3, selectedId: 1 })), {
    text: 'Runde 3: Zug deiner Einheit.',
    kind: 'system',
  });
});

test('death, alert and enemy-turn-end add no log entry', () => {
  assert.equal(logLine(deathEvent({ unitId: 2 })), null);
  assert.equal(logLine(alertEvent({ groupId: 0 })), null);
  assert.equal(logLine(enemyTurnEndEvent({ enemyId: 2 })), null);
});

test('appendLogs prepends one entry per renderable event, newest first', () => {
  const logs = appendLogs(
    [INTRO_LOG],
    [turnStartEvent({ turn: 1 }), alertEvent({ groupId: 0 }), overwatchEvent({ unitId: 1, name: 'Ada' })]
  );
  assert.deepEqual(
    logs.map((entry) => entry.text),
    ['Ada: Overwatch.', 'Feindzug beginnt.', 'Einsatz bereit. Halte die Position.']
  );
  assert.deepEqual(
    logs.map((entry) => entry.id),
    [3, 2, 1]
  );
});

test('appendLogs keeps only the newest LOG_LIMIT entries', () => {
  const events = Array.from({ length: LOG_LIMIT + 2 }, (_, index) =>
    overwatchEvent({ unitId: index, name: `U${index}` })
  );
  const logs = appendLogs([], events);
  assert.equal(logs.length, LOG_LIMIT);
  assert.equal(logs[0].text, `U${LOG_LIMIT + 1}: Overwatch.`);
});

test('appendLogs returns the same array when no event is renderable', () => {
  const logs = [INTRO_LOG];
  assert.equal(appendLogs(logs, [alertEvent({ groupId: 0 })]), logs);
});
