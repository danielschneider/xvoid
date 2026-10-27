// Auto-save and round-rewind persistence. Pure (de)serialization plus a thin localStorage wrapper.
// The battlefield map is constant for a game, so it is stored once instead of once per checkpoint.

export const SAVE_KEY = 'xvoid.save.v1';
export const SAVE_VERSION = 1;
export const MAX_ROUNDS_BACK = 5;
// The current round's start plus up to MAX_ROUNDS_BACK earlier round starts.
export const MAX_CHECKPOINTS = MAX_ROUNDS_BACK + 1;

const withoutMap = (state) => {
  const rest = { ...state };
  delete rest.map;
  return rest;
};

function isGameState(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray(value.units) &&
    typeof value.phase === 'string' &&
    Number.isInteger(value.turn) &&
    Number.isInteger(value.rng) &&
    Number.isInteger(value.nextId) &&
    Number.isInteger(value.generation)
  );
}

function isMap(value) {
  return !!value && typeof value === 'object' && !!value.cells && Number.isInteger(value.size);
}

// payload: { current: state, checkpoints: state[] } where checkpoints are round-start states, oldest first.
export function serializeGame({ current, checkpoints }) {
  return JSON.stringify({
    version: SAVE_VERSION,
    map: current.map,
    current: withoutMap(current),
    checkpoints: checkpoints.map(withoutMap),
  });
}

// Returns { current, checkpoints } or null when the text is missing, corrupt or from another version.
export function deserializeGame(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.version !== SAVE_VERSION || !isMap(data.map) || !isGameState(data.current)) return null;
  if (!Array.isArray(data.checkpoints)) return null;
  if (data.checkpoints.length < 1 || data.checkpoints.length > MAX_CHECKPOINTS) return null;
  if (!data.checkpoints.every(isGameState)) return null;
  const { map } = data;
  return {
    current: { ...data.current, map },
    checkpoints: data.checkpoints.map((checkpoint) => ({ ...checkpoint, map })),
  };
}

export function saveGame(payload) {
  try {
    globalThis.localStorage.setItem(SAVE_KEY, serializeGame(payload));
    return true;
  } catch {
    // Storage disabled or quota exceeded: the game keeps running without persistence.
    return false;
  }
}

export function loadGame() {
  try {
    const text = globalThis.localStorage.getItem(SAVE_KEY);
    return text === null ? null : deserializeGame(text);
  } catch {
    return null;
  }
}

export function clearGame() {
  try {
    globalThis.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
