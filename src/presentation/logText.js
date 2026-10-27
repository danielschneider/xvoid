import { EVENT_TYPES } from './events.js';

// Comms log copy. Rules emit events with the data; this file owns every log string.
// Identical to the strings the reducer used to build inline.

export const LOG_LIMIT = 5;

// Entry shown before the first event (state.logs starts with it).
export const INTRO_LOG = Object.freeze({ id: 1, text: 'Einsatz bereit. Halte die Position.', kind: 'system' });

const entry = (text, kind) => ({ text, kind });

// Enemy wording per role and intent (the intents are 'hold', 'advance' and 'retreat').
export const ENEMY_TEXT = Object.freeze({
  raider: { hold: 'hält die Position', advance: 'rückt vor' },
  stalker: { hold: 'bleibt verborgen', advance: 'rückt vor' },
  scout: { hold: 'hält die Position', advance: 'rückt vor', retreat: 'zieht sich zurück' },
  guard: { hold: 'hält den Posten', advance: 'kehrt zum Posten zurück' },
});

const BLOCKED_TEXT = Object.freeze({
  sight: 'Schusslinie blockiert.',
  range: 'Ziel außer Reichweite.',
});

function enemyVerb(role, intent) {
  const verb = ENEMY_TEXT[role]?.[intent];
  if (!verb) throw new Error(`No log wording for role ${String(role)} intent ${String(intent)}`);
  return verb;
}

function shotLine(event) {
  const prefix = event.reaction ? 'Overwatch: ' : '';
  if (!event.hit) return entry(`${prefix}${event.shooterName} verfehlt ${event.targetName}.`, 'combat');
  if (event.crit) {
    return entry(`${prefix}${event.shooterName} landet einen KRITISCHEN Treffer auf ${event.targetName} für ${event.damage} Schaden.`, 'hit');
  }
  return entry(`${prefix}${event.shooterName} trifft ${event.targetName} für ${event.damage} Schaden.`, 'hit');
}

function moveLine(event) {
  if (event.intent === 'walk') return entry(`${event.name} rückt ${event.steps} Felder vor.`, 'move');
  if (event.intent === 'patrol') return entry(`${event.name} patrouilliert.`, 'move');
  return entry(`${event.name} ${enemyVerb(event.role, event.intent)}.`, 'move');
}

// One line per event type. Types missing from this table (death, alert, enemy-turn-end) add no log entry.
const LINES = {
  [EVENT_TYPES.shot]: shotLine,
  [EVENT_TYPES.blocked]: (event) => entry(BLOCKED_TEXT[event.reason], 'combat'),
  [EVENT_TYPES.move]: moveLine,
  [EVENT_TYPES.hold]: (event) => entry(`${event.name} ${enemyVerb(event.role, 'hold')}.`, 'combat'),
  [EVENT_TYPES.overwatch]: (event) => entry(`${event.name}: Overwatch.`, 'system'),
  [EVENT_TYPES.turnStart]: () => entry('Feindzug beginnt.', 'combat'),
  [EVENT_TYPES.roundStart]: (event) => entry(`Runde ${event.turn}: Zug deiner Einheit.`, 'system'),
};

// Returns { text, kind } for an event that shows in the log, or null.
export function logLine(event) {
  const line = LINES[event.type];
  return line ? line(event) : null;
}

// Prepends one log entry per renderable event, newest first, and keeps the newest `limit`.
// Returns the same array when no event is renderable.
export function appendLogs(logs, events, limit = LOG_LIMIT) {
  let next = logs;
  for (const event of events) {
    const line = logLine(event);
    if (line) next = [{ id: (next[0]?.id || 0) + 1, text: line.text, kind: line.kind }, ...next].slice(0, limit);
  }
  return next;
}
