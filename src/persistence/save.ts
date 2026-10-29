// Auto-save and round-rewind persistence. Pure (de)serialization plus a thin localStorage wrapper.
// The battlefield map is constant for a game, so it is stored once instead of once per checkpoint.

import type { Battlefield, GameState } from '../rules/types.ts';

export const SAVE_KEY = 'xvoid.save.v1';
export const SAVE_VERSION = 1;
export const MAX_ROUNDS_BACK = 5;
// The current round's start plus up to MAX_ROUNDS_BACK earlier round starts.
export const MAX_CHECKPOINTS = MAX_ROUNDS_BACK + 1;

// Payload handed to saveGame. Checkpoints are round-start states, oldest first.
export interface SavePayload {
  current: GameState;
  checkpoints: GameState[];
}

// On-disk shape: the map is stored once at the top level, so per-state copies omit it.
interface SaveData {
  version: number;
  map: Battlefield;
  current: Omit<GameState, 'map'>;
  checkpoints: Omit<GameState, 'map'>[];
}

const withoutMap = (state: GameState): Omit<GameState, 'map'> => {
  const { map: _map, ...rest } = state;
  return rest;
};

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return (
    Array.isArray(state.units) &&
    typeof state.phase === 'string' &&
    Number.isInteger(state.turn) &&
    Number.isInteger(state.rng) &&
    Number.isInteger(state.nextId) &&
    Number.isInteger(state.generation)
  );
}

function isMap(value: unknown): value is Battlefield {
  if (!value || typeof value !== 'object') return false;
  const map = value as Record<string, unknown>;
  return !!map.cells && Number.isInteger(map.size);
}

export function serializeGame({ current, checkpoints }: SavePayload): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    map: current.map,
    current: withoutMap(current),
    checkpoints: checkpoints.map(withoutMap),
  };
  return JSON.stringify(data);
}

// Returns { current, checkpoints } or null when the text is missing, corrupt or from another version.
export function deserializeGame(text: string): SavePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const data = parsed as Record<string, unknown>;
  if (data.version !== SAVE_VERSION || !isMap(data.map) || !isGameState(data.current)) return null;
  const { map } = data;
  const { current } = data;
  const { checkpoints } = data;
  if (!Array.isArray(checkpoints)) return null;
  if (checkpoints.length < 1 || checkpoints.length > MAX_CHECKPOINTS) return null;
  if (!checkpoints.every(isGameState)) return null;
  return {
    current: { ...current, map },
    checkpoints: checkpoints.map((checkpoint: GameState) => ({ ...checkpoint, map })),
  };
}

export function saveGame(payload: SavePayload): boolean {
  try {
    globalThis.localStorage.setItem(SAVE_KEY, serializeGame(payload));
    return true;
  } catch {
    // Storage disabled or quota exceeded: the game keeps running without persistence.
    return false;
  }
}

export function loadGame(): SavePayload | null {
  try {
    const text = globalThis.localStorage.getItem(SAVE_KEY);
    return text === null ? null : deserializeGame(text);
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    globalThis.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
