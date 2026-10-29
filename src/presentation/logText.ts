import type { EnemyIntent, EnemyRole } from '../rules/types.ts';
import { EVENT_TYPES } from './events.ts';
import type { GameEvent, MoveEvent, ShotEvent } from './events.ts';

// Comms log copy. Rules emit events with the data; this file owns every log string.
// Identical to the strings the reducer used to build inline.

export const LOG_LIMIT = 5;

export type LogKind = 'system' | 'combat' | 'hit' | 'move';

export interface LogLine {
  text: string;
  kind: LogKind;
}

export interface LogEntry extends LogLine {
  id: number;
}

// Entry shown before the first event (state.logs starts with it).
export const INTRO_LOG: LogEntry = Object.freeze({
  id: 1,
  text: 'Einsatz bereit. Halte die Position.',
  kind: 'system',
});

const entry = (text: string, kind: LogKind): LogLine => ({ text, kind });

// Enemy wording per role and intent. Partial because not every role has every intent.
export const ENEMY_TEXT: Readonly<Record<EnemyRole, Partial<Record<EnemyIntent, string>>>> = Object.freeze({
  raider: { hold: 'hält die Position', advance: 'rückt vor', cover: 'geht in Deckung' },
  stalker: { hold: 'bleibt verborgen', advance: 'rückt vor', cover: 'verschwindet hinter Deckung' },
  scout: { hold: 'hält die Position', advance: 'rückt vor', retreat: 'zieht sich zurück', cover: 'geht in Deckung' },
  guard: { hold: 'hält den Posten', advance: 'kehrt zum Posten zurück', cover: 'geht in Deckung' },
  crawler: { hold: 'kauert lauernd', advance: 'kriecht vor', cover: 'duckt sich weg' },
  soldier: { hold: 'hält die Deckung', advance: 'rückt vor', cover: 'geht in Deckung' },
  monster: { hold: 'brüllt und wartet', advance: 'stürmt vor' },
  sneaker: { hold: 'lauert im Schatten', advance: 'schleicht sich heran', cover: 'verschwindet im Schatten' },
});

export const BLOCKED_TEXT: Readonly<Record<'sight' | 'range', string>> = Object.freeze({
  sight: 'Schusslinie blockiert.',
  range: 'Ziel außer Reichweite.',
});

function enemyVerb(role: EnemyRole, intent: EnemyIntent): string {
  const verb = ENEMY_TEXT[role]?.[intent];
  if (!verb) throw new Error(`No log wording for role ${role} intent ${intent}`);
  return verb;
}

function shotLine(event: ShotEvent): LogLine {
  const prefix = event.reaction ? 'Overwatch: ' : '';
  if (!event.hit) return entry(`${prefix}${event.shooterName} verfehlt ${event.targetName}.`, 'combat');
  if (event.crit) {
    return entry(
      `${prefix}${event.shooterName} landet einen KRITISCHEN Treffer auf ${event.targetName} für ${event.damage} Schaden.`,
      'hit'
    );
  }
  return entry(`${prefix}${event.shooterName} trifft ${event.targetName} für ${event.damage} Schaden.`, 'hit');
}

// Player walks and patrols have fixed wording; enemy intents resolve through ENEMY_TEXT.
function moveLine(event: MoveEvent): LogLine {
  if (event.intent === 'walk') return entry(`${event.name} rückt ${event.steps} Felder vor.`, 'move');
  if (event.intent === 'patrol') return entry(`${event.name} patrouilliert.`, 'move');
  if (!event.role) throw new Error(`Enemy move ${event.unitId} has no role`);
  return entry(`${event.name} ${enemyVerb(event.role, event.intent)}.`, 'move');
}

// One line per event type. Types without a case (death, alert, enemy-turn-end) add no log entry.
// Returns { text, kind } for an event that shows in the log, or null.
export function logLine(event: GameEvent): LogLine | null {
  switch (event.type) {
    case EVENT_TYPES.shot:
      return shotLine(event);
    case EVENT_TYPES.blocked:
      return entry(BLOCKED_TEXT[event.reason], 'combat');
    case EVENT_TYPES.move:
      return moveLine(event);
    case EVENT_TYPES.hold:
      return entry(`${event.name} ${enemyVerb(event.role, 'hold')}.`, 'combat');
    case EVENT_TYPES.overwatch:
      return entry(`${event.name}: Overwatch.`, 'system');
    case EVENT_TYPES.turnStart:
      return entry('Feindzug beginnt.', 'combat');
    case EVENT_TYPES.roundStart:
      return entry(`Runde ${event.turn}: Zug deiner Einheit.`, 'system');
    default:
      return null;
  }
}

// Prepends one log entry per renderable event, newest first, and keeps the newest `limit`.
// Returns the same array when no event is renderable.
export function appendLogs(logs: LogEntry[], events: GameEvent[], limit: number = LOG_LIMIT): LogEntry[] {
  let next = logs;
  for (const event of events) {
    const line = logLine(event);
    if (line) next = [{ id: (next[0]?.id || 0) + 1, text: line.text, kind: line.kind }, ...next].slice(0, limit);
  }
  return next;
}
