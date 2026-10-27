// Plain event objects emitted by rules/. Data only: no log text, no timing, no DOM.
// Rules construct them; presentation/ decides how they look and how long they last.

export const EVENT_TYPES = Object.freeze({
  shot: 'shot',
  move: 'move',
  death: 'death',
  alert: 'alert',
  enemyTurnEnd: 'enemy-turn-end',
  turnStart: 'turn-start',
  roundStart: 'round-start',
  overwatch: 'overwatch',
  hold: 'hold',
});

export const shotEvent = ({ shooterId, targetId, hit, crit, damage, enemyShot, reaction = false }) => ({
  type: EVENT_TYPES.shot, shooterId, targetId, hit, crit, damage, enemyShot, reaction,
});

export const moveEvent = ({ unitId, steps, enemy = false }) => ({
  type: EVENT_TYPES.move, unitId, steps, enemy,
});

export const deathEvent = ({ unitId }) => ({ type: EVENT_TYPES.death, unitId });

export const alertEvent = ({ groupId }) => ({ type: EVENT_TYPES.alert, groupId });

export const enemyTurnEndEvent = ({ enemyId }) => ({ type: EVENT_TYPES.enemyTurnEnd, enemyId });

export const turnStartEvent = ({ turn }) => ({ type: EVENT_TYPES.turnStart, turn });

export const roundStartEvent = ({ turn, selectedId }) => ({ type: EVENT_TYPES.roundStart, turn, selectedId });

export const overwatchEvent = ({ unitId }) => ({ type: EVENT_TYPES.overwatch, unitId });

export const holdEvent = ({ unitId }) => ({ type: EVENT_TYPES.hold, unitId });

// Appends events to the store's log and keeps only the newest `limit` entries.
// Returns the same array when there is nothing to append.
export function appendEvents(eventLog, events, limit) {
  if (events.length === 0) return eventLog;
  return [...eventLog, ...events].slice(-limit);
}
