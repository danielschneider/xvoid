// Plain event objects emitted by rules/. Data only: no log text, no timing, no DOM.
// Rules construct them; presentation/ decides how they look and how long they last.

export const EVENT_TYPES = Object.freeze({
  shot: 'shot',
  blocked: 'blocked',
  move: 'move',
  death: 'death',
  alert: 'alert',
  enemyTurnEnd: 'enemy-turn-end',
  turnStart: 'turn-start',
  roundStart: 'round-start',
  overwatch: 'overwatch',
  hold: 'hold',
});

export const shotEvent = ({ shooterId, shooterName, targetId, targetName, hit, crit, damage, enemyShot, reaction = false }) => ({
  type: EVENT_TYPES.shot, shooterId, shooterName, targetId, targetName, hit, crit, damage, enemyShot, reaction,
});

// A shot that never resolved. reason: 'sight' (line of sight blocked) or 'range' (target too far).
export const blockedEvent = ({ shooterId, targetId, reason }) => ({
  type: EVENT_TYPES.blocked, shooterId, targetId, reason,
});

// intent: 'walk' (player move), 'patrol', 'advance' or 'retreat' (enemy moves).
// role: the enemy's aiRole for enemy moves, null for player moves.
export const moveEvent = ({ unitId, name, steps, enemy = false, role = null, intent = 'walk' }) => ({
  type: EVENT_TYPES.move, unitId, name, steps, enemy, role, intent,
});

export const deathEvent = ({ unitId }) => ({ type: EVENT_TYPES.death, unitId });

export const alertEvent = ({ groupId }) => ({ type: EVENT_TYPES.alert, groupId });

export const enemyTurnEndEvent = ({ enemyId }) => ({ type: EVENT_TYPES.enemyTurnEnd, enemyId });

export const turnStartEvent = ({ turn }) => ({ type: EVENT_TYPES.turnStart, turn });

export const roundStartEvent = ({ turn, selectedId }) => ({ type: EVENT_TYPES.roundStart, turn, selectedId });

export const overwatchEvent = ({ unitId, name }) => ({ type: EVENT_TYPES.overwatch, unitId, name });

export const holdEvent = ({ unitId, name, role }) => ({ type: EVENT_TYPES.hold, unitId, name, role });

// Appends events to the store's log and keeps only the newest `limit` entries.
// Returns the same array when there is nothing to append.
export function appendEvents(eventLog, events, limit) {
  if (events.length === 0) return eventLog;
  return [...eventLog, ...events].slice(-limit);
}
