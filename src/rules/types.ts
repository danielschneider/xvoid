// Shared domain types for rules/. Data shapes only: no runtime code lives here.

export type Team = 'player' | 'alien';

export type Terrain = 'floor' | 'wall' | 'partition' | 'rail' | 'pillar' | 'console' | 'door' | 'stairs';

export type Cover = 0 | 1 | 2;

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
  rooms: BuildingRecord[];
  cells: Record<string, Cell>;
  transitions: Record<string, Position[]>;
}

export interface Unit extends Position {
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  shield: number;
  ap: number;
  facing?: number;
  status: 'overwatch' | null;
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
  doors?: { sides: string[]; width: number };
}

export interface BuildingRecord {
  doors: { sides: string[]; width: number };
  lanes: Set<string>;
  stairKeys: Set<string>;
  topLevel: number;
}
