// Plain event objects emitted by rules/. Data only: no log text, no timing, no DOM.
// Rules construct them; presentation/ decides how they look and how long they last.

import type { EnemyRole } from '../rules/types.ts';

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
} as const);

export type BlockedReason = 'sight' | 'range';

// 'walk' and 'patrol' are player/patrol moves; the rest are enemy intents.
export type MoveIntent = 'walk' | 'patrol' | 'advance' | 'retreat' | 'cover';

export interface ShotEvent {
  type: typeof EVENT_TYPES.shot;
  shooterId: string;
  shooterName: string;
  targetId: string;
  targetName: string;
  hit: boolean;
  crit: boolean;
  damage: number;
  enemyShot: boolean;
  reaction: boolean;
}

export interface BlockedEvent {
  type: typeof EVENT_TYPES.blocked;
  shooterId: string;
  targetId: string;
  reason: BlockedReason;
}

export interface MoveEvent {
  type: typeof EVENT_TYPES.move;
  unitId: string;
  name: string;
  steps: number;
  enemy: boolean;
  role: EnemyRole | null;
  intent: MoveIntent;
}

export interface DeathEvent {
  type: typeof EVENT_TYPES.death;
  unitId: string;
}

export interface AlertEvent {
  type: typeof EVENT_TYPES.alert;
  groupId: number;
}

export interface EnemyTurnEndEvent {
  type: typeof EVENT_TYPES.enemyTurnEnd;
  enemyId: string;
}

export interface TurnStartEvent {
  type: typeof EVENT_TYPES.turnStart;
  turn: number;
}

export interface RoundStartEvent {
  type: typeof EVENT_TYPES.roundStart;
  turn: number;
  selectedId: string | null;
}

export interface OverwatchEvent {
  type: typeof EVENT_TYPES.overwatch;
  unitId: string;
  name: string;
}

export interface HoldEvent {
  type: typeof EVENT_TYPES.hold;
  unitId: string;
  name: string;
  role: EnemyRole;
}

// Discriminated on `type`: narrowing on event.type gives the exact payload.
export type GameEvent =
  | ShotEvent
  | BlockedEvent
  | MoveEvent
  | DeathEvent
  | AlertEvent
  | EnemyTurnEndEvent
  | TurnStartEvent
  | RoundStartEvent
  | OverwatchEvent
  | HoldEvent;

export const shotEvent = ({
  shooterId,
  shooterName,
  targetId,
  targetName,
  hit,
  crit,
  damage,
  enemyShot,
  reaction = false,
}: Omit<ShotEvent, 'type' | 'reaction'> & { reaction?: boolean }): ShotEvent => ({
  type: EVENT_TYPES.shot,
  shooterId,
  shooterName,
  targetId,
  targetName,
  hit,
  crit,
  damage,
  enemyShot,
  reaction,
});

// A shot that never resolved. reason: 'sight' (line of sight blocked) or 'range' (target too far).
export const blockedEvent = ({ shooterId, targetId, reason }: Omit<BlockedEvent, 'type'>): BlockedEvent => ({
  type: EVENT_TYPES.blocked,
  shooterId,
  targetId,
  reason,
});

// intent: 'walk' (player move), 'patrol', 'advance', 'retreat' or 'cover' (enemy moves).
// role: the enemy's aiRole for enemy moves, null for player moves.
export const moveEvent = ({
  unitId,
  name,
  steps,
  enemy = false,
  role = null,
  intent = 'walk',
}: Partial<Pick<MoveEvent, 'enemy' | 'role' | 'intent'>> & Omit<MoveEvent, 'type' | 'enemy' | 'role' | 'intent'>): MoveEvent => ({
  type: EVENT_TYPES.move,
  unitId,
  name,
  steps,
  enemy,
  role,
  intent,
});

export const deathEvent = ({ unitId }: Omit<DeathEvent, 'type'>): DeathEvent => ({ type: EVENT_TYPES.death, unitId });

export const alertEvent = ({ groupId }: Omit<AlertEvent, 'type'>): AlertEvent => ({ type: EVENT_TYPES.alert, groupId });

export const enemyTurnEndEvent = ({ enemyId }: Omit<EnemyTurnEndEvent, 'type'>): EnemyTurnEndEvent => ({ type: EVENT_TYPES.enemyTurnEnd, enemyId });

export const turnStartEvent = ({ turn }: Omit<TurnStartEvent, 'type'>): TurnStartEvent => ({ type: EVENT_TYPES.turnStart, turn });

export const roundStartEvent = ({ turn, selectedId }: Omit<RoundStartEvent, 'type'>): RoundStartEvent => ({ type: EVENT_TYPES.roundStart, turn, selectedId });

export const overwatchEvent = ({ unitId, name }: Omit<OverwatchEvent, 'type'>): OverwatchEvent => ({ type: EVENT_TYPES.overwatch, unitId, name });

export const holdEvent = ({ unitId, name, role }: Omit<HoldEvent, 'type'>): HoldEvent => ({ type: EVENT_TYPES.hold, unitId, name, role });

// Appends events to the store's log and keeps only the newest `limit` entries.
// Returns the same array when there is nothing to append.
export function appendEvents(eventLog: GameEvent[], events: GameEvent[], limit: number): GameEvent[] {
  if (events.length === 0) return eventLog;
  return [...eventLog, ...events].slice(-limit);
}
