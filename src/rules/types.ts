// Shared domain types for rules/. Data shapes only: no runtime code lives here.

import type { GameEvent } from '../presentation/events.ts';
import type { LogEntry } from '../presentation/logText.ts';

export type Team = 'player' | 'alien';

export type Terrain = 'floor' | 'wall' | 'partition' | 'rail' | 'pillar' | 'console' | 'door' | 'stairs';

export type Cover = 0 | 1 | 2;

// A building face. Doors open on one or two faces of the footprint.
export type Side = 'north' | 'south' | 'west' | 'east';

export interface Position {
  x: number;
  z: number;
  level?: number;
}

export interface Cell extends Position {
  level: number;
  terrain: Terrain;
  walkable: boolean;
  cover: Cover;
  structure: boolean;
  corridor?: boolean;
  building?: { id?: number; role: string } | null;
}

export interface Battlefield {
  seed: number;
  size: number;
  rooms: Room[];
  cells: Record<string, Cell>;
  transitions: Record<string, Position[]>;
}

export interface Unit extends Position {
  // Units always have a storey: placement sets level 0 and movement keeps it current.
  level: number;
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  shield: number;
  ap: number;
  facing?: number;
  // Absent until a unit takes overwatch; cleared to null by moves and turn changes.
  status?: 'overwatch' | null;
  // Player-only: movement budget per AP and flat damage bonus (see templates.ts).
  moveRange?: number;
  power?: number;
  className?: string;
}

// Reserved keys and doors for one raised building, used to validate or roll back the build.
export interface Room {
  id: number;
  x: number;
  z: number;
  w: number;
  h: number;
  anchor?: boolean;
  topLevel?: number;
  doors?: { sides: Side[]; width: number };
}

export interface BuildingRecord {
  doors: { sides: Side[]; width: number };
  lanes: Set<string>;
  stairKeys: Set<string>;
  topLevel: number;
}

// Enemy archetypes and the intents an enemy can take on its turn (keys of ROLES and ENEMY_TEXT).
export type EnemyRole = 'raider' | 'stalker' | 'scout' | 'guard' | 'crawler' | 'soldier' | 'monster' | 'sneaker';

export type EnemyIntent = 'hold' | 'advance' | 'retreat' | 'cover';

// Enemy-only fields. Post coordinates are the cell the enemy was spawned on.
export interface Enemy extends Unit {
  team: 'alien';
  aiRole: EnemyRole;
  groupId: number;
  postX: number;
  postZ: number;
}

// True for alien units. Enemies are the only units created with team 'alien' (see placement.ts).
export const isEnemy = (unit: Unit): unit is Enemy => unit.team === 'alien';

// Movement in flight: `path` starts at the unit's origin cell, `step` is the playback index.
export interface MovementState {
  id: number;
  unitId: string;
  path: Position[];
  step: number;
}

export interface LastShot {
  from: Position;
  to: Position;
  hit: boolean;
  crit: boolean;
  damage: number;
  overshoot: number;
  enemyShot: boolean;
  id: number;
}

export interface GameState {
  generation: number;
  map: Battlefield;
  units: Unit[];
  selectedId: string | null;
  targetId: string | null;
  moveMode: boolean;
  shootMode: boolean;
  enemyTurnOrder: string[];
  enemyTurnIndex: number;
  alertedGroups: number[];
  movement: MovementState | null;
  turn: number;
  phase: 'player' | 'enemy';
  showUpper: boolean;
  logs: LogEntry[];
  lastShot: LastShot | null;
  eventLog: GameEvent[];
  rng: number;
  nextId: number;
}

// Result of a pure step: the next state plus the events it produced.
export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
